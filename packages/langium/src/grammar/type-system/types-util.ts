/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';
import { CompositeGeneratorNode, IndentNode, NL } from '../../generator/generator-node';
import { processGeneratorNode } from '../../generator/node-processor';
import { References } from '../../references/references';
import { CstNode } from '../../syntax-tree';
import { getDocument } from '../../utils/ast-util';
import { MultiMap } from '../../utils/collections';
import { AstNodeLocator } from '../../workspace/ast-node-locator';
import { LangiumDocuments } from '../../workspace/documents';
import { AbstractType, Grammar, Interface, isInterface, isParserRule, isType, ParserRule, Type } from '../generated/ast';
import { isDataTypeRule, resolveImport } from '../internal-grammar-util';

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
    unions: UnionType[];
}

export class UnionType {
    name: string;
    union: PropertyType[];
    reflection: boolean;
    superTypes = new Set<string>();

    constructor(name: string, union: PropertyType[], options?: { reflection: boolean }) {
        this.name = name;
        this.union = union;
        this.reflection = options?.reflection ?? false;
    }

    toString(): string {
        const typeNode = new CompositeGeneratorNode();
        typeNode.contents.push(`export type ${this.name} = ${propertyTypeArrayToString(this.union)};`, NL);

        if (this.reflection) pushReflectionInfo(this.name, typeNode);
        return processGeneratorNode(typeNode);
    }
}

export class InterfaceType {
    name: string;
    superTypes = new Set<string>();
    interfaceSuperTypes: string[]  = [];
    subTypes = new Set<string>();
    containerTypes = new Set<string>();
    properties: Property[];

    constructor(name: string, superTypes: string[], properties: Property[]) {
        this.name = name;
        this.superTypes = new Set(superTypes);
        this.interfaceSuperTypes = [...superTypes];
        this.properties = properties;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.interfaceSuperTypes.length > 0 ? distinctAndSorted([...this.interfaceSuperTypes]) : ['AstNode'];
        interfaceNode.contents.push(`export interface ${this.name} extends ${superTypes.join(', ')} {`, NL);

        const propertiesNode = new IndentNode();
        if (this.containerTypes.size > 0) {
            propertiesNode.contents.push(`readonly $container: ${distinctAndSorted([...this.containerTypes]).join(' | ')};`, NL);
        }

        for (const property of distinctAndSorted(this.properties, (a, b) => a.name.localeCompare(b.name))) {
            const optional = property.optional && !property.typeAlternatives.some(e => e.array) && !property.typeAlternatives.every(e => e.types.length === 1 && e.types[0] === 'boolean') ? '?' : '';
            const type = propertyTypeArrayToString(property.typeAlternatives);
            propertiesNode.contents.push(`${property.name}${optional}: ${type}`, NL);
        }
        interfaceNode.contents.push(propertiesNode, '}', NL);

        pushReflectionInfo(this.name, interfaceNode);
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
export type AstResources = {
    parserRules: Set<ParserRule>,
    datatypeRules: Set<ParserRule>,
    interfaces: Set<Interface>,
    types: Set<Type>
}

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
        for (const superType of interfaceType.interfaceSuperTypes) {
            const superTypeProperties = map.get(superType);
            if (superTypeProperties) {
                map.addAll(interfaceType.name, superTypeProperties);
            }
        }
    }
    return map;
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
    return distinctAndSorted(alternatives.map(typePropertyToString)).join(' | ');
}

export function distinctAndSorted<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
    return Array.from(new Set(list)).sort(compareFn);
}

export function typePropertyToString(propertyType: PropertyType): string {
    let res = distinctAndSorted(propertyType.types).join(' | ');
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

export function collectChildrenTypes(interfaceNode: Interface, references: References, langiumDocuments: LangiumDocuments, nodeLocator: AstNodeLocator): Set<Interface | Type> {
    const childrenTypes = new Set<Interface | Type>();
    childrenTypes.add(interfaceNode);
    const refs = references.findReferences(interfaceNode, {});
    refs.forEach(ref => {
        const doc = langiumDocuments.getOrCreateDocument(ref.sourceUri);
        const astNode = nodeLocator.getAstNode(doc, ref.sourcePath);
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
