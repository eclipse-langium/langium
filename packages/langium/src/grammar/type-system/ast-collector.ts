/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Grammar } from '../generated/ast';
import { LangiumDocuments } from '../../workspace/documents';
import { sortInterfacesTopologically } from './types-util';
import { AstTypes, InterfaceType, isInterfaceType, isUnionType, TypeOption, UnionType } from './type-collector/types';
import { collectTypeResources } from './type-collector/all-types';
import { isPrimitiveType } from '../internal-grammar-util';

/**
 * Collects all types for the generated AST. The types collector entry point.
 * @param documents Documents to resolve imports that were used in the given grammars.
 * @param grammars Grammars for which it's necessary to build an AST.
 */
export function collectAst(documents: LangiumDocuments, grammars: Grammar[]): AstTypes {
    const { inferred, declared } = collectTypeResources(documents, grammars);

    const astTypes = {
        interfaces: mergeAndRemoveDuplicates<InterfaceType>(inferred.interfaces,declared.interfaces),
        unions: mergeAndRemoveDuplicates<UnionType>(inferred.unions, declared.unions),
    };

    sortInterfacesTopologically(astTypes.interfaces);
    astTypes.unions.sort((a, b) => a.name.localeCompare(b.name));

    specifyAstNodeProperies(astTypes);
    return astTypes;
}

function mergeAndRemoveDuplicates<T extends { name: string }>(inferred: T[], declared: T[]): T[] {
    return Array.from(inferred.concat(declared)
        .reduce((acc, type) => { acc.set(type.name, type); return acc; }, new Map<string, T>())
        .values());
}

export function specifyAstNodeProperies(astTypes: AstTypes) {
    const nameToType = filterInterfaceLikeTypes(astTypes);
    addSubTypes(nameToType);
    buildContainerTypes(nameToType);
}

/**
 * Removes union types that reference only to primitive types or
 * types that reference only to primitive types.
 */
function filterInterfaceLikeTypes({ interfaces, unions }: AstTypes): Map<string, TypeOption> {
    const nameToType = (interfaces as TypeOption[]).concat(unions)
        .reduce((acc, e) => { acc.set(e.name, e); return acc; }, new Map<string, TypeOption>());

    const cache = new Map<UnionType, boolean>();
    function isDataTypeUnion(union: UnionType, visited = new Set<UnionType>()): boolean {
        if (cache.has(union)) return cache.get(union)!;
        if (visited.has(union)) return true;
        visited.add(union);

        const ruleCalls = union.alternatives.flatMap(e => e.types).filter(e => !isPrimitiveType(e));
        if (ruleCalls.length === 0) {
            return true;
        }
        for (const ruleCall of ruleCalls) {
            const type = nameToType.get(ruleCall);
            if (type && (isInterfaceType(type) || isUnionType(type) && !isDataTypeUnion(type, visited))) {
                return false;
            }
        }
        return true;
    }

    for (const union of unions) {
        const isDataType = isDataTypeUnion(union);
        cache.set(union, isDataType);
    }
    for (const [union, isDataType] of cache) {
        if (isDataType) {
            nameToType.delete(union.name);
        }
    }
    return nameToType;
}

function addSubTypes(nameToType: Map<string, TypeOption>) {
    for (const interfaceType of nameToType.values()) {
        for (const superTypeName of interfaceType.realSuperTypes) {
            nameToType.get(superTypeName)
                ?.subTypes.add(interfaceType.name);
        }
    }

}

/**
 * Builds container types for given interfaces.
 * @param interfaces The interfaces that have to get container types.
 */
function buildContainerTypes(nameToType: Map<string, TypeOption>): void {
    const types = Array.from(nameToType.values());

    // 1st stage: collect container types
    const interfaces = types.filter(e => isInterfaceType(e)) as InterfaceType[];
    for (const interfaceType of interfaces) {
        const refTypes = interfaceType.properties.flatMap(property => property.typeAlternatives.filter(e => !e.reference).flatMap(e => e.types));
        for (const refType of refTypes) {
            nameToType.get(refType)?.containerTypes.add(interfaceType.name);
        }
    }

    // 2nd stage: share container types
    const connectedComponents: TypeOption[][] = [];
    calculateConnectedComponents(connectedComponents, types);
    shareContainerTypes(connectedComponents);
}

function calculateConnectedComponents(connectedComponents: TypeOption[][], interfaces: TypeOption[]): void {
    function dfs(typeInterface: TypeOption): TypeOption[] {
        const component: TypeOption[] = [typeInterface];
        visited.add(typeInterface.name);
        const allTypes = [...typeInterface.subTypes, ...typeInterface.realSuperTypes];
        for (const nextTypeInterfaceName of allTypes) {
            if (!visited.has(nextTypeInterfaceName)) {
                const nextTypeInterface = interfaces.find(e => e.name === nextTypeInterfaceName);
                if (nextTypeInterface) {
                    component.push(...dfs(nextTypeInterface));
                }
            }
        }
        return component;
    }

    const visited: Set<string> = new Set();
    for (const typeInterface of interfaces) {
        if (!visited.has(typeInterface.name)) {
            connectedComponents.push(dfs(typeInterface));
        }
    }
}

function shareContainerTypes(connectedComponents: TypeOption[][]): void {
    for (const component of connectedComponents) {
        const superSet = new Set<string>();
        component.forEach(type => type.containerTypes.forEach(e => superSet.add(e)));
        component.forEach(type => type.containerTypes = superSet);
    }
}
