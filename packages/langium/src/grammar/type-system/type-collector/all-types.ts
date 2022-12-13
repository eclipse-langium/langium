/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { collectInferredTypes } from './inferred-types';
import { collectDeclaredTypes } from './declared-types';
import { LangiumDocuments, Grammar } from '../../..';
import { getDocument } from '../../../utils/ast-util';
import { MultiMap } from '../../../utils/collections';
import { ParserRule, Interface, Type, isParserRule } from '../../generated/ast';
import { isDataTypeRule, resolveImport } from '../../internal-grammar-util';
import { mergeInterfaces } from '../types-util';
import { AstTypes, InterfaceType, isInterfaceType } from './types';
import { URI } from 'vscode-uri';

export type AstResources = {
    parserRules: ParserRule[],
    datatypeRules: ParserRule[],
    interfaces: Interface[],
    types: Type[],
}

export type TypeResources = {
    inferred: AstTypes,
    declared: AstTypes,
    astResources: AstResources,
}

export function collectTypeResources(grammars: Grammar | Grammar[], documents?: LangiumDocuments): TypeResources {
    const astResources = collectAllAstResources(grammars, documents);
    const inferred = collectInferredTypes(astResources.parserRules, astResources.datatypeRules);
    const declared = collectDeclaredTypes(astResources.interfaces, astResources.types);

    shareSuperTypesFromUnions(inferred, declared);
    addSuperProperties(mergeInterfaces(inferred, declared));

    return { astResources, inferred, declared };
}

function addSuperProperties(allTypes: InterfaceType[]) {
    function addSuperPropertiesInternal(type: InterfaceType, visited = new Set<InterfaceType>()) {
        if (visited.has(type)) return;
        visited.add(type);

        for (const superTypeName of type.printingSuperTypes) {
            const superType = allTypes.find(e => e.name === superTypeName);

            if (superType && isInterfaceType(superType)) {
                addSuperPropertiesInternal(superType);
                superType.superProperties
                    .entriesGroupedByKey()
                    .forEach(propInfo => type.superProperties.addAll(propInfo[0], propInfo[1]));
            }
        }
    }

    for (const type of allTypes) {
        addSuperPropertiesInternal(type);
    }
}

function shareSuperTypesFromUnions(inferred: AstTypes, declared: AstTypes): void {
    const childToSuper = new MultiMap<string, string>();
    const allUnions = inferred.unions.concat(declared.unions);
    for (const union of allUnions) {
        if (union.reflection) {
            for (const propType of union.alternatives) {
                propType.types.forEach(type => childToSuper.add(type, union.name));
            }
        }
    }

    function addSuperTypes(types: AstTypes, child: string, parents: string[]) {
        const childType = types.interfaces.find(e => e.name === child) ??
            types.unions.find(e => e.name === child);
        if (childType) {
            parents.forEach(e => childType.realSuperTypes.add(e));
        }
    }

    for (const [child, parents] of childToSuper.entriesGroupedByKey()) {
        addSuperTypes(inferred, child, parents);
        addSuperTypes(declared, child, parents);
    }
}

///////////////////////////////////////////////////////////////////////////////

export function collectAllAstResources(grammars: Grammar | Grammar[], documents?: LangiumDocuments, visited: Set<URI> = new Set(),
    astResources: AstResources = { parserRules: [], datatypeRules: [], interfaces: [], types: [] }): AstResources {

    if (!Array.isArray(grammars)) grammars = [grammars];
    for (const grammar of grammars) {
        const doc = getDocument(grammar);
        if (visited.has(doc.uri)) {
            continue;
        }
        visited.add(doc.uri);
        for (const rule of grammar.rules) {
            if (isParserRule(rule) && !rule.fragment) {
                if (isDataTypeRule(rule)) {
                    astResources.datatypeRules.push(rule);
                } else {
                    astResources.parserRules.push(rule);
                }
            }
        }
        grammar.interfaces.forEach(e => astResources.interfaces.push(e));
        grammar.types.forEach(e => astResources.types.push(e));

        if (documents) {
            const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)!);
            collectAllAstResources(importedGrammars, documents, visited, astResources);
        }
    }
    return astResources;
}
