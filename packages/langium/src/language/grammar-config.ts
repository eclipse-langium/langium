/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumServices } from '../services.js';
import { DefaultNameRegexp } from '../utils/cst-util.js';
import { isCommentTerminal } from '../utils/grammar-util.js';
import { isMultilineComment } from '../utils/regex-util.js';
import { isTerminalRule } from '../grammar/generated/ast.js';
import { terminalRegex } from '../utils/grammar-util.js';

export interface GrammarConfig {
    /**
     * Lists all rule names which are classified as multiline comment rules
     */
    multilineCommentRules: string[]
    /**
     * A regular expression which matches characters of names
     */
    nameRegexp: RegExp
}

export function createGrammarConfig(services: LangiumServices): GrammarConfig {
    const rules: string[] = [];
    const grammar = services.Grammar;
    for (const rule of grammar.rules) {
        if (isTerminalRule(rule) && isCommentTerminal(rule) && isMultilineComment(terminalRegex(rule))) {
            rules.push(rule.name);
        }
    }
    return {
        multilineCommentRules: rules,
        nameRegexp: DefaultNameRegexp
    };
}
