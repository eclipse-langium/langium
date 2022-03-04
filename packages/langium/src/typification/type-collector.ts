/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';
import { isDataTypeRule, resolveImport } from '../grammar/grammar-util';
import { Grammar, Interface, isParserRule, ParserRule, Type } from '../grammar/generated/ast';
import { LangiumDocuments } from '../workspace/documents';
import { stream } from '../utils/stream';
import { getDocument } from '../utils/ast-util';
import { collectInferredTypes } from './inferred-types';
import { collectDeclaredTypes } from './declared-types';
import { AstTypes, InterfaceType, TypeType } from './types-util';

/**
 * Collects all types for the generated AST. The types collector entry point.
 * @param documents Documents to resolve imports that were used in the given grammars.
 * @param grammars Grammars for which it's necessary to build an AST.
 */
export function collectAst(documents: LangiumDocuments, grammars: Grammar[]): AstTypes {
    const astResources = collectAllAstResources(grammars, documents);
    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred);

    const interfaces: InterfaceType[] = inferred.interfaces.concat(declared.interfaces);
    const types: TypeType[] = inferred.types.concat(declared.types);

    sortInterfaces(interfaces);
    types.sort((a, b) => a.name.localeCompare(b.name));

    return {
        interfaces: stream(interfaces).distinct(e => e.name).toArray(),
        types: stream(types).distinct(e => e.name).toArray(),
    };
}

export type InferredDeclaredTypes = {
    inferred: AstTypes,
    declared: AstTypes
}

/**
 * Collects declared and inferred types for the generated AST separately. The types collector entry point.
 * @param grammars Grammars that necessary to validate.
 */
export function collectAstForValidation(grammar: Grammar): InferredDeclaredTypes {
    const astResources = collectAllAstResources([grammar]);
    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    return {
        inferred,
        declared: collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred)
    };
}

type AstResources = {
    parserRules: Set<ParserRule>,
    datatypeRules: Set<ParserRule>,
    interfaces: Set<Interface>,
    types: Set<Type>
}

function collectAllAstResources(grammars: Grammar[], documents?: LangiumDocuments, visited: Set<URI> = new Set(),
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

/**
 * Performs topological sorting on the generated interfaces.
 * @param interfaces The interfaces to sort topologically.
 * @returns A topologically sorted set of interfaces.
 */
function sortInterfaces(interfaces: InterfaceType[]): InterfaceType[] {
    type TypeNode = {
        value: InterfaceType;
        nodes: TypeNode[];
    }

    const nodes: TypeNode[] = interfaces
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(e => <TypeNode>{ value: e, nodes: [] });
    for (const node of nodes) {
        node.nodes = nodes.filter(e => node.value.superTypes.includes(e.value.name));
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
