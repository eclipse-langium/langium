/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { DefaultNameRegexp } from '../utils/cst-util';
import { isCommentTerminal } from '../utils/grammar-util';
import { isMultilineComment } from '../utils/regex-util';
import { isTerminalRule } from './generated/ast';
import { terminalRegex } from './internal-grammar-util';

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
