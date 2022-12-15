/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { References } from '../../references/references';
import { MultiMap } from '../../utils/collections';
import { AstNodeLocator } from '../../workspace/ast-node-locator';
import { LangiumDocuments } from '../../workspace/documents';
import { Interface, Type, AbstractType, isInterface, isType } from '../generated/ast';
import { AstTypes, InterfaceType, Property, PropertyType, TypeOption } from './type-collector/types';

/**
 * Collects all properties of all interface types. Includes super type properties.
 * @param interfaces A topologically sorted array of interfaces.
 */
export function collectAllProperties(interfaces: InterfaceType[]): MultiMap<string, Property> {
    const map = new MultiMap<string, Property>();
    for (const interfaceType of interfaces) {
        map.addAll(interfaceType.name, interfaceType.properties);
    }
    for (const interfaceType of interfaces) {
        for (const superType of interfaceType.printingSuperTypes) {
            const superTypeProperties = map.get(superType);
            if (superTypeProperties) {
                map.addAll(interfaceType.name, superTypeProperties);
            }
        }
    }
    return map;
}

export function distinctAndSorted<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
    return Array.from(new Set(list)).sort(compareFn);
}

export function collectChildrenTypes(interfaceNode: Interface, references: References, langiumDocuments: LangiumDocuments, nodeLocator: AstNodeLocator): Set<Interface | Type> {
    const childrenTypes = new Set<Interface | Type>();
    childrenTypes.add(interfaceNode);
    const refs = references.findReferences(interfaceNode, {});
    refs.forEach(ref => {
        const doc = langiumDocuments.getOrCreateDocument(ref.sourceUri);
        const astNode = nodeLocator.getAstNode(doc.parseResult.value, ref.sourcePath);
        if (isInterface(astNode)) {
            childrenTypes.add(astNode);
            const childrenOfInterface = collectChildrenTypes(astNode, references, langiumDocuments, nodeLocator);
            childrenOfInterface.forEach(child => childrenTypes.add(child));
        } else if (astNode && isType(astNode.$container)) {
            childrenTypes.add(astNode.$container);
        }
    });
    return childrenTypes;
}

export function collectSuperTypes(ruleNode: AbstractType): Set<Interface> {
    const superTypes = new Set<Interface>();
    if (isInterface(ruleNode)) {
        superTypes.add(ruleNode);
        ruleNode.superTypes.forEach(superType => {
            if (isInterface(superType.ref)) {
                superTypes.add(superType.ref);
                const collectedSuperTypes = collectSuperTypes(superType.ref);
                for (const superType of collectedSuperTypes) {
                    superTypes.add(superType);
                }
            }
        });
    } else if (isType(ruleNode)) {
        ruleNode.typeAlternatives.forEach(typeAlternative => {
            if (typeAlternative.refType?.ref) {
                if (isInterface(typeAlternative.refType.ref) || isType(typeAlternative.refType.ref)) {
                    const collectedSuperTypes = collectSuperTypes(typeAlternative.refType.ref);
                    for (const superType of collectedSuperTypes) {
                        superTypes.add(superType);
                    }
                }
            }
        });
    }
    return superTypes;
}

export function comparePropertyType(a: PropertyType, b: PropertyType): boolean {
    return a.array === b.array &&
        a.reference === b.reference &&
        compareLists(a.types, b.types);
}

function compareLists<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): boolean {
    const distinctAndSortedA = distinctAndSorted(a);
    const distinctAndSortedB = distinctAndSorted(b);
    if (distinctAndSortedA.length !== distinctAndSortedB.length) return false;
    return distinctAndSortedB.every((e, i) => eq(e, distinctAndSortedA[i]));
}

export function mergeInterfaces(inferred: AstTypes, declared: AstTypes): InterfaceType[] {
    return inferred.interfaces.concat(declared.interfaces);
}

export function mergeTypesAndInterfaces(astTypes: AstTypes): TypeOption[] {
    return (astTypes.interfaces as TypeOption[]).concat(astTypes.unions);
}

/**
 * Performs topological sorting on the generated interfaces.
 * @param interfaces The interfaces to sort topologically.
 * @returns A topologically sorted set of interfaces.
 */
export function sortInterfacesTopologically(interfaces: InterfaceType[]): InterfaceType[] {
    type TypeNode = {
        value: InterfaceType;
        nodes: TypeNode[];
    }

    const nodes: TypeNode[] = interfaces
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(e => <TypeNode>{ value: e, nodes: [] });
    for (const node of nodes) {
        node.nodes = nodes.filter(e => node.value.realSuperTypes.has(e.value.name));
    }
    const l: TypeNode[] = [];
    const s = nodes.filter(e => e.nodes.length === 0);
    while (s.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const n = s.shift()!;
        if (!l.includes(n)) {
            l.push(n);
            nodes
                .filter(e => e.nodes.includes(n))
                .forEach(m => s.push(m));
        }
    }
    return l.map(e => e.value);
}

export function addSubTypes(nameToType: Map<string, TypeOption>) {
    for (const interfaceType of nameToType.values()) {
        for (const superTypeName of interfaceType.realSuperTypes) {
            nameToType.get(superTypeName)
                ?.subTypes.add(interfaceType.name);
        }
    }
}
