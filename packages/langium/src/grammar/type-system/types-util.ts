/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';
import { CompositeGeneratorNode, IndentNode, NL } from '../../generator/generator-node';
import { processGeneratorNode } from '../../generator/node-processor';
import { Grammar, Interface, isParserRule, ParserRule, Type } from '../generated/ast';
import { isDataTypeRule, resolveImport } from '../grammar-util';
import { getDocument } from '../../utils/ast-util';
import { LangiumDocuments } from '../../workspace/documents';

export type Property = {
    name: string,
    optional: boolean,
    typeAlternatives: PropertyType[]
}

export type PropertyType = {
    types: string[],
    reference: boolean,
    array: boolean
}

export type AstTypes = {
    interfaces: InterfaceType[];
    types: TypeType[];
}

export class TypeType {
    name: string;
    alternatives: PropertyType[];
    reflection: boolean;
    superTypes: string[] = [];

    constructor(name: string, alternatives: PropertyType[], options?: { reflection: boolean }) {
        this.name = name;
        this.alternatives = alternatives;
        this.reflection = options?.reflection ?? false;
    }

    toString(): string {
        const typeNode = new CompositeGeneratorNode();
        typeNode.contents.push(`export type ${this.name} = ${propertyTypeArrayToString(this.alternatives)};`, NL);

        if (this.reflection) pushReflectionInfo(this.name, typeNode);
        return processGeneratorNode(typeNode);
    }
}

export class InterfaceType {
    name: string;
    superTypes: string[];
    printingSuperTypes: string[];
    subTypes: string[] = [];
    containerTypes: string[] = [];
    properties: Property[];

    constructor(name: string, superTypes: string[], properties: Property[]) {
        this.name = name;
        this.superTypes = superTypes;
        this.printingSuperTypes = JSON.parse(JSON.stringify(superTypes));
        this.properties = properties;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.printingSuperTypes.length > 0 ? distictAndSorted(this.printingSuperTypes) : ['AstNode'];
        interfaceNode.contents.push(`export interface ${this.name} extends ${superTypes.join(', ')} {`, NL);

        const propertiesNode = new IndentNode();
        if (this.containerTypes.length > 0) {
            propertiesNode.contents.push(`readonly $container: ${distictAndSorted(this.containerTypes).join(' | ')};`, NL);
        }

        for (const property of distictAndSorted(this.properties, (a, b) => a.name.localeCompare(b.name))) {
            const optional = property.optional && property.typeAlternatives.some(e => e.reference) && !property.typeAlternatives.some(e => e.array) ? '?' : '';
            const type = propertyTypeArrayToString(property.typeAlternatives);
            propertiesNode.contents.push(`${property.name}${optional}: ${type}`, NL);
        }
        interfaceNode.contents.push(propertiesNode, '}', NL);

        pushReflectionInfo(this.name, interfaceNode);
        return processGeneratorNode(interfaceNode);
    }
}

type AstResources = {
    parserRules: Set<ParserRule>,
    datatypeRules: Set<ParserRule>,
    interfaces: Set<Interface>,
    types: Set<Type>
}

export function collectAllAstResources(grammars: Grammar[], documents?: LangiumDocuments, visited: Set<URI> = new Set(),
    astResources: AstResources = { parserRules: new Set(), datatypeRules: new Set(), interfaces: new Set(), types: new Set() }): AstResources {

    for (const grammar of grammars) {
        const doc = getDocument(grammar);
        if (visited.has(doc.uri)) {
            continue;
        }
        visited.add(doc.uri);
        for (const rule of grammar.rules) {
            if (isParserRule(rule) && !rule.fragment) {
                if (isDataTypeRule(rule)) {
                    astResources.datatypeRules.add(rule);
                } else {
                    astResources.parserRules.add(rule);
                }
            }
        }
        grammar.interfaces.forEach(e => astResources.interfaces.add(e));
        grammar.types.forEach(e => astResources.types.add(e));

        if (documents) {
            const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)!);
            collectAllAstResources(importedGrammars, documents, visited, astResources);
        }
    }
    return astResources;
}

export function propertyTypeArrayToString(alternatives: PropertyType[]): string {
    return distictAndSorted(alternatives.map(typePropertyToString)).join(' | ');
}

export function distictAndSorted<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
    return Array.from(new Set(list)).sort(compareFn);
}

export function typePropertyToString(propertyType: PropertyType): string {
    let res = distictAndSorted(propertyType.types).join(' | ');
    res = propertyType.reference ? `Reference<${res}>` : res;
    res = propertyType.array ? `Array<${res}>` : res;
    return res;
}

function pushReflectionInfo(name: string, node: CompositeGeneratorNode) {
    node.contents.push(NL, `export const ${name} = '${name}';`, NL, NL);
    node.contents.push(`export function is${name}(item: unknown): item is ${name} {`, NL);
    const methodBody = new IndentNode();
    methodBody.contents.push(`return reflection.isInstance(item, ${name});`, NL);
    node.contents.push(methodBody, '}', NL);
}
