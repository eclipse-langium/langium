/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, escapeRegExp, Grammar, GrammarAST, isCommentTerminal, NL, toString } from 'langium';
import { terminalRegex } from 'langium/lib/grammar/internal-grammar-util';
import { LangiumLanguageConfig } from '../../package';
import { collectKeywords } from '../util';

interface HighlightElement {
    pattern: string
    greedy?: boolean;
}

type PrismHighlighter = Record<string, HighlightElement>;

const idRegex = /^[a-zA-Z_]+$/;
export function generatePrismHighlighting(grammar: Grammar, config: LangiumLanguageConfig): string {
    const highlighter: PrismHighlighter = {};
    const keywords = collectKeywords(grammar);
    const terminals = getTerminals(grammar);
    const seenTerminals = new Set<GrammarAST.TerminalRule>();
    const modifier = config.caseInsensitive ? 'i' : '';

    for (const terminal of terminals) {
        if (isCommentTerminal(terminal)) {
            seenTerminals.add(terminal);
            highlighter[terminal.name] = {
                pattern: `/${terminalRegex(terminal)}/`,
                greedy: true
            };
        }
    }
    for (const terminal of terminals) {
        if (terminal.name.toLowerCase() === 'string' && !seenTerminals.has(terminal)) {
            seenTerminals.add(terminal);
            highlighter[terminal.name] = {
                pattern: `/${terminalRegex(terminal)}/`,
                greedy: true
            };
        }
    }

    const filteredKeywords = keywords.filter(e => idRegex.test(e)).sort((a, b) => b.length - a.length).map(escapeRegExp);
    highlighter.keyword = {
        pattern: `/\\b(${filteredKeywords.join('|')})\\b/${modifier}`
    };

    for (const terminal of terminals) {
        if (!seenTerminals.has(terminal) && !terminal.hidden) {
            highlighter[terminal.name] = {
                pattern: `/${terminalRegex(terminal)}/`,
            };
        }
    }

    return generate(highlighter);
}

function generate(highlighter: PrismHighlighter): string {
    const generatorNode = new CompositeGeneratorNode('export default {', NL);
    generatorNode.indent(propertyIndent => {
        for (const [name, value] of Object.entries(highlighter)) {
            let propertyName = name;
            if (!idRegex.test(name)) {
                propertyName = `"${name}"`;
            }
            propertyIndent.append(propertyName, ': {', NL);
            propertyIndent.indent(objectIndent => {
                objectIndent.append('pattern: ', value.pattern);
                if (value.greedy) {
                    objectIndent.append(',', NL, 'greedy: true');
                }
                objectIndent.append(NL);
            });
            propertyIndent.append('},', NL);
        }
    });
    generatorNode.append('};', NL);
    return toString(generatorNode);
}

function getTerminals(grammar: Grammar): GrammarAST.TerminalRule[] {
    return grammar.rules.filter(GrammarAST.isTerminalRule);
}
