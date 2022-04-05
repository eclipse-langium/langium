/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Grammar } from '../generated/ast';
import { LangiumDocuments } from '../../workspace/documents';
import { stream } from '../../utils/stream';
import { collectInferredTypes } from './inferred-types';
import { collectDeclaredTypes } from './declared-types';
import { AstTypes, collectAllAstResources, InterfaceType, UnionType } from './types-util';

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
    const types: UnionType[] = inferred.unions.concat(declared.unions);

    sortInterfaces(interfaces);
    types.sort((a, b) => a.name.localeCompare(b.name));

    return {
        interfaces: stream(interfaces).distinct(e => e.name).toArray(),
        unions: stream(types).distinct(e => e.name).toArray(),
    };
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
        node.nodes = nodes.filter(e => node.value.superTypes.has(e.value.name));
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
