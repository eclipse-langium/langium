/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, NL } from '../../../generator/generator-node';
import { processGeneratorNode } from '../../../generator/node-processor';
import { CstNode } from '../../../syntax-tree';
import { MultiMap } from '../../../utils/collections';
import { Assignment, Action, TypeAttribute } from '../../generated/ast';
import { distinctAndSorted } from '../types-util';

export type Property = {
    name: string,
    optional: boolean,
    typeAlternatives: PropertyType[],
    astNodes: Set<Assignment | Action | TypeAttribute>,
}

export type PropertyType = {
    types: string[],
    reference: boolean,
    array: boolean,
}

export type AstTypes = {
    interfaces: InterfaceType[],
    unions: UnionType[],
}

export function isUnionType(type: TypeOption): type is UnionType {
    return type && 'alternatives' in type;
}

export function isInterfaceType(type: TypeOption): type is InterfaceType {
    return type && 'properties' in type;
}

export type TypeOption = InterfaceType | UnionType;

export class UnionType {
    name: string;
    realSuperTypes = new Set<string>();
    subTypes = new Set<string>();
    containerTypes = new Set<string>();
    typeTypes = new Set<string>();

    alternatives: PropertyType[];
    reflection: boolean;

    constructor(name: string, alts: PropertyType[], options?: { reflection: boolean }) {
        this.name = name;
        this.alternatives = alts;
        this.reflection = options?.reflection ?? false;
    }

    toAstTypesString(): string {
        const unionNode = new CompositeGeneratorNode();
        unionNode.append(`export type ${this.name} = ${propertyTypesToString(this.alternatives, 'AstType')};`, NL);

        if (this.reflection) {
            unionNode.append(NL);
            pushReflectionInfo(unionNode, this.name);
        }
        return processGeneratorNode(unionNode);
    }

    toDeclaredTypesString(reservedWords: Set<string>): string {
        const unionNode = new CompositeGeneratorNode();
        unionNode.append(`type ${escapeReservedWords(this.name, reservedWords)} = ${propertyTypesToString(this.alternatives, 'DeclaredType')};`, NL);
        return processGeneratorNode(unionNode);
    }
}

export class InterfaceType {
    name: string;
    realSuperTypes = new Set<string>();
    subTypes = new Set<string>();
    containerTypes = new Set<string>();
    typeTypes = new Set<string>();

    printingSuperTypes: string[] = [];
    properties: Property[];
    superProperties: MultiMap<string, Property> = new MultiMap();

    constructor(name: string, superTypes: string[], properties: Property[]) {
        this.name = name;
        this.realSuperTypes = new Set(superTypes);
        this.printingSuperTypes = [...superTypes];
        this.properties = properties;
        properties.forEach(prop => this.superProperties.add(prop.name, prop));
    }

    toAstTypesString(): string {
        const interfaceNode = new CompositeGeneratorNode();

        const superTypes = this.printingSuperTypes.length > 0 ? distinctAndSorted([...this.printingSuperTypes]) : ['AstNode'];
        interfaceNode.append(`export interface ${this.name} extends ${superTypes.join(', ')} {`, NL);

        interfaceNode.indent(body => {
            if (this.containerTypes.size > 0) {
                body.append(`readonly $container: ${distinctAndSorted([...this.containerTypes]).join(' | ')};`, NL);
            }
            if (this.typeTypes.size > 0) {
                body.append(`readonly $type: ${distinctAndSorted([...this.typeTypes]).map(e => `'${e}'`).join(' | ')};`, NL);
            }
            pushProperties(body, this.properties, 'AstType');
        });
        interfaceNode.append('}', NL);

        interfaceNode.append(NL);
        pushReflectionInfo(interfaceNode, this.name);
        return processGeneratorNode(interfaceNode);
    }

    toDeclaredTypesString(reservedWords: Set<string>): string {
        const interfaceNode = new CompositeGeneratorNode();

        const name = escapeReservedWords(this.name, reservedWords);
        const superTypes = Array.from(this.printingSuperTypes).join(', ');
        interfaceNode.append(`interface ${name}${superTypes.length > 0 ? ` extends ${superTypes}` : ''} {`, NL);

        interfaceNode.indent(body => pushProperties(body, this.properties, 'DeclaredType', reservedWords));

        interfaceNode.append('}', NL);
        return processGeneratorNode(interfaceNode);
    }
}

export class TypeResolutionError extends Error {
    readonly target: CstNode | undefined;

    constructor(message: string, target: CstNode | undefined) {
        super(message);
        this.name = 'TypeResolutionError';
        this.target = target;
    }

}

export function propertyTypesToString(alternatives: PropertyType[], mode: 'AstType' | 'DeclaredType'='AstType'): string {
    function propertyTypeToString(propertyType: PropertyType): string {
        let res = distinctAndSorted(propertyType.types).join(' | ');
        res = propertyType.reference ? (mode === 'AstType' ? `Reference<${res}>` : `@${res}`) : res;
        res = propertyType.array ? (mode === 'AstType' ? `Array<${res}>` : `${res}[]`) : res;
        return res;
    }

    return distinctAndSorted(alternatives.map(propertyTypeToString)).join(' | ');
}

function pushProperties(node: CompositeGeneratorNode, properties: Property[],
    mode: 'AstType' | 'DeclaredType', reserved = new Set<string>()) {

    function propertyToString(property: Property): string {
        const name = mode === 'AstType' ? property.name : escapeReservedWords(property.name, reserved);
        const optional = property.optional &&
            !property.typeAlternatives.some(e => e.array) &&
            !property.typeAlternatives.every(e => e.types.length === 1 && e.types[0] === 'boolean');
        const propType = propertyTypesToString(property.typeAlternatives, mode);
        return `${name}${optional ? '?' : ''}: ${propType}`;
    }

    distinctAndSorted(properties, (a, b) => a.name.localeCompare(b.name))
        .forEach(property => node.append(propertyToString(property), NL));
}

function pushReflectionInfo(node: CompositeGeneratorNode, name: string) {
    node.append(`export const ${name} = '${name}';`, NL);
    node.append(NL);

    node.append(`export function is${name}(item: unknown): item is ${name} {`, NL);
    node.indent(body => body.append(`return reflection.isInstance(item, ${name});`, NL));
    node.append('}', NL);
}

function escapeReservedWords(name: string, reserved: Set<string>): string {
    return reserved.has(name) ? `^${name}` : name;
}
