/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { isMultilineComment } from '../utils/regex-util';
import { isTerminalRule } from './generated/ast';
import { isCommentTerminal, terminalRegex } from './grammar-util';

export interface GrammarConfig {
    multilineCommentRules: string[]
}

export function createGrammarConfig(services: LangiumServices): GrammarConfig {
    const rules: string[] = [];
    const grammar = services.Grammar;
    for (const rule of grammar.rules) {
        if (isTerminalRule(rule) && isCommentTerminal(rule) && isMultilineComment(terminalRegex(rule))) {
            rules.push(rule.name);
        }
    }
    return { multilineCommentRules: rules };
}
