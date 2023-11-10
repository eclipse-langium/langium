/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar, LangiumServices } from 'langium';
import { joinToNode, toString } from 'langium/generate';
import { collectAst } from 'langium/types';
import { LangiumGrammarGrammar } from 'langium/internal';
import { collectKeywords } from './util.js';

export function generateTypesFile(services: LangiumServices, grammars: Grammar[]): string {
    const { unions, interfaces } = collectAst(grammars, services.shared.workspace.LangiumDocuments);
    const reservedWords = new Set(collectKeywords(LangiumGrammarGrammar()));

    const fileNode = joinToNode([
        joinToNode(unions, union => union.toDeclaredTypesString(reservedWords), { appendNewLineIfNotEmpty: true }),
        joinToNode(interfaces, iFace => iFace.toDeclaredTypesString(reservedWords), { appendNewLineIfNotEmpty: true })
    ]);

    return toString(fileNode);
}
