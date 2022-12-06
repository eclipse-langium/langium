/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Grammar } from '../generated/ast';
import { LangiumDocuments } from '../../workspace/documents';
import { AstTypes, InterfaceType, sortInterfacesTopologically, UnionType } from './types-util';
import { collectTypeResources } from './type-collector/all-types';
import { buildContainerTypes } from './type-collector/container-property';

/**
 * Collects all types for the generated AST. The types collector entry point.
 * @param documents Documents to resolve imports that were used in the given grammars.
 * @param grammars Grammars for which it's necessary to build an AST.
 */
export function collectAst(documents: LangiumDocuments, grammars: Grammar[]): AstTypes {
    const { inferred, declared } = collectTypeResources(documents, grammars);

    const astTypes = {
        interfaces: mergeAndRemoveDuplicates({ inferred: inferred.interfaces, declared: declared.interfaces }),
        unions: mergeAndRemoveDuplicates({ inferred: inferred.unions, declared: declared.unions }),
    };

    sortInterfacesTopologically(astTypes.interfaces);
    astTypes.unions.sort((a, b) => a.name.localeCompare(b.name));

    addSubTypes(astTypes);
    buildContainerTypes(astTypes);

    return astTypes;
}

function addSubTypes({ interfaces, unions }: AstTypes) {
    const allTypes = (interfaces as Array<InterfaceType | UnionType>).concat(unions);
    for (const type of allTypes) {
        for (const superTypeName of type.realSuperTypes) {
            allTypes.find(e => e.name === superTypeName)?.subTypes.add(type.name);
        }
    }
}

function mergeAndRemoveDuplicates<T extends { name: string }>({ inferred, declared }: { inferred: T[], declared: T[]}): T[] {
    return Array.from(inferred.concat(declared)
        .reduce((acc, type) => { acc.set(type.name, type); return acc; }, new Map<string, T>())
        .values());
}
