/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Grammar } from '../generated/ast';
import { LangiumDocuments } from '../../workspace/documents';
import { sortInterfacesTopologically } from './types-util';
import { AstTypes, InterfaceType, UnionType } from './type-collector/types';
import { collectTypeResources } from './type-collector/all-types';

/**
 * Collects all types for the generated AST. The types collector entry point.
 * @param documents Documents to resolve imports that were used in the given grammars.
 * @param grammars Grammars for which it's necessary to build an AST.
 */
export function collectAst(documents: LangiumDocuments, grammars: Grammar[]): AstTypes {
    const { inferred, declared } = collectTypeResources(documents, grammars);

    const astTypes = {
        interfaces: removeDuplicatesForInterfaces(inferred.interfaces,declared.interfaces),
        unions: removeDuplicatesForUnions(inferred.unions, declared.unions),
    };

    sortInterfacesTopologically(astTypes.interfaces);
    astTypes.unions.sort((a, b) => a.name.localeCompare(b.name));

    return astTypes;
}

function removeDuplicatesForUnions(inferred: UnionType[], declared: UnionType[]): UnionType[] {
    return Array.from(inferred.concat(declared)
        .reduce((acc, type) => { acc.set(type.name, type); return acc; }, new Map<string, UnionType>())
        .values());
}

function removeDuplicatesForInterfaces(inferred: InterfaceType[], declared: InterfaceType[]): InterfaceType[] {
    const res = inferred.reduce((acc, e) => { acc.set(e.name, e); return acc; }, new Map<string, InterfaceType>());
    for (const decl of declared) {
        const infer = res.get(decl.name);
        if (infer) {
            decl.containerTypes = infer.containerTypes;
            res.set(decl.name, decl);
        }
    }
    return Array.from(res.values());
}
