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

export type Field = {
    name: string,
    optional: boolean,
    typeAlternatives: FieldType[]
}

export type FieldType = {
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
    alternatives: FieldType[];
    reflection: boolean;
    superTypes: string[] = [];

    constructor(name: string, alternatives: FieldType[], options?: { reflection: boolean }) {
        this.name = name;
        this.alternatives = alternatives;
        this.reflection = options?.reflection ?? false;
    }

    toString(): string {
        const typeNode = new CompositeGeneratorNode();
        typeNode.contents.push(`export type ${this.name} = ${fieldTypeArrayToString(this.alternatives)};`, NL);

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
    fields: Field[];

    constructor(name: string, superTypes: string[], fields: Field[]) {
        this.name = name;
        this.superTypes = superTypes;
        this.printingSuperTypes = JSON.parse(JSON.stringify(superTypes));
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.printingSuperTypes.length > 0 ? distictAndSorted(this.printingSuperTypes) : ['AstNode'];
        interfaceNode.contents.push(`export interface ${this.name} extends ${superTypes.join(', ')} {`, NL);

        const fieldsNode = new IndentNode();
        if (this.containerTypes.length > 0) {
            fieldsNode.contents.push(`readonly $container: ${distictAndSorted(this.containerTypes).join(' | ')};`, NL);
        }

        for (const field of distictAndSorted(this.fields, (a, b) => a.name.localeCompare(b.name))) {
            const optional = field.optional && field.typeAlternatives.some(e => e.reference) && !field.typeAlternatives.some(e => e.array) ? '?' : '';
            const type = fieldTypeArrayToString(field.typeAlternatives);
            fieldsNode.contents.push(`${field.name}${optional}: ${type}`, NL);
        }
        interfaceNode.contents.push(fieldsNode, '}', NL);

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

export function compareFieldType(a: FieldType, b: FieldType): boolean {
    return a.array === b.array &&
        a.reference === b.reference &&
        compareLists(a.types, b.types);
}

export function compareLists<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x: T, y: T) => x === y): boolean {
    if (a.length !== b.length) return false;
    const distictAndSortedA = distictAndSorted(a);
    return distictAndSorted(b).every((e, i) => eq(e, distictAndSortedA[i]));
}

function fieldTypeArrayToString(alternatives: FieldType[]): string {
    return distictAndSorted(alternatives.map(typeFieldToString)).join(' | ');
}

function distictAndSorted<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
    return Array.from(new Set(list)).sort(compareFn);
}

function typeFieldToString(fieldType: FieldType): string {
    let res = distictAndSorted(fieldType.types).join(' | ');
    res = fieldType.reference ? `Reference<${res}>` : res;
    res = fieldType.array ? `Array<${res}>` : res;
    return res;
}

function pushReflectionInfo(name: string, node: CompositeGeneratorNode) {
    node.contents.push(NL, `export const ${name} = '${name}';`, NL, NL);
    node.contents.push(`export function is${name}(item: unknown): item is ${name} {`, NL);
    const methodBody = new IndentNode();
    methodBody.contents.push(`return reflection.isInstance(item, ${name});`, NL);
    node.contents.push(methodBody, '}', NL);
}
