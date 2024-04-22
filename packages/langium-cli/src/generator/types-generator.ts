/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar, LangiumCoreServices } from 'langium';
import { joinToNode, toString } from 'langium/generate';
import { collectAst, LangiumGrammarGrammar } from 'langium/grammar';
import { collectKeywords } from './langium-util.js';

export function generateTypesFile(services: LangiumCoreServices, grammars: Grammar[]): string {
    const { unions, interfaces } = collectAst(grammars, services.shared.workspace.LangiumDocuments);
    const reservedWords = new Set(collectKeywords(LangiumGrammarGrammar()));

    const fileNode = joinToNode([
        joinToNode(unions, union => union.toDeclaredTypesString(reservedWords), { appendNewLineIfNotEmpty: true }),
        joinToNode(interfaces, iFace => iFace.toDeclaredTypesString(reservedWords), { appendNewLineIfNotEmpty: true })
    ]);

    return toString(fileNode);
}
