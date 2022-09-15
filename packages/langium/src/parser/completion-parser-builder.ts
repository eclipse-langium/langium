/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumCompletionParser } from './langium-parser';
import { LangiumServices } from '../services';
import { createParser } from './parser-builder-base';

export function createCompletionParser(services: LangiumServices): LangiumCompletionParser {
    const grammar = services.Grammar;
    const buildTokens = services.parser.TokenBuilder.buildTokens(grammar, { caseInsensitive: services.LanguageMetaData.caseInsensitive });
    const parser = new LangiumCompletionParser(services, buildTokens);
    createParser(grammar, parser, buildTokens);
    parser.finalize();
    return parser;
}
