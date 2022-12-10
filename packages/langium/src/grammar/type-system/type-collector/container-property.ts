/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstTypes } from './types';

/**
 * Builds types of `$container` property for given interfaces.
 * @param interfaces The interfaces that have to get container types.
 */
export function buildContainerTypes({ interfaces, unions }: AstTypes) {
    // 1st stage: collect container types
    for (const type of interfaces) {
        const ruleCalls = type.properties
            .flatMap(property => property.typeAlternatives.filter(e => !e.reference).flatMap(e => e.types));
        for (const typeName of ruleCalls) {
            interfaces.find(e => e.name === typeName)?.containerTypes.add(type.name);
            unions.find(e => e.name === typeName)?.containerTypes.add(type.name);
        }
    }

    for (const type of unions) {
        const ruleCalls = type.alternatives.filter(e => !e.reference).flatMap(e => e.types);
        for (const typeName of ruleCalls) {
            interfaces.find(e => e.name === typeName)?.containerTypes.add(type.name);
            unions.find(e => e.name === typeName)?.containerTypes.add(type.name);
        }
    }

    // 2nd stage: share container types
    const connectedComponents: CommonType[][] = calculateConnectedComponents((interfaces as CommonType[]).concat(unions));
    shareContainerTypes(connectedComponents);
}

type CommonType = {
    name: string,
    subTypes: Set<string>,
    realSuperTypes: Set<string>,
    containerTypes: Set<string>,
};

function calculateConnectedComponents(allTypes: CommonType[]): CommonType[][] {
    function dfs(type: CommonType): CommonType[] {
        const component: CommonType[] = [type];
        visited.add(type.name);
        const nextTypes = [...type.subTypes, ...type.realSuperTypes];
        for (const nextTypeInterfaceName of nextTypes) {
            if (!visited.has(nextTypeInterfaceName)) {
                const nextTypeInterface = allTypes.find(e => e.name === nextTypeInterfaceName);
                if (nextTypeInterface) {
                    component.push(...dfs(nextTypeInterface));
                }
            }
        }
        return component;
    }

    const connectedComponents: CommonType[][] = [];
    const visited: Set<string> = new Set();
    for (const type of allTypes) {
        if (!visited.has(type.name)) {
            connectedComponents.push(dfs(type));
        }
    }
    return connectedComponents;
}

function shareContainerTypes(connectedComponents: CommonType[][]): void {
    for (const component of connectedComponents) {
        const superSet = new Set<string>();
        component.forEach(type => type.containerTypes.forEach(e => superSet.add(e)));
        component.forEach(type => type.containerTypes = superSet);
    }
}
