/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar, LangiumServices } from 'langium';
import { CompositeGeneratorNode, NL, toString } from 'langium';
import { collectAst } from 'langium/types';
import { LangiumGrammarGrammar } from 'langium/internal';
import { collectKeywords } from './util.js';

export function generateTypesFile(services: LangiumServices, grammars: Grammar[]): string {
    const { unions, interfaces } = collectAst(grammars, services.shared.workspace.LangiumDocuments);
    const reservedWords = new Set(collectKeywords(LangiumGrammarGrammar()));
    const fileNode = new CompositeGeneratorNode();

    unions.forEach(union => fileNode.append(union.toDeclaredTypesString(reservedWords)).append(NL));
    interfaces.forEach(iFace => fileNode.append(iFace.toDeclaredTypesString(reservedWords)).append(NL));

    return toString(fileNode);
}
