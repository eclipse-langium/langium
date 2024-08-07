/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { GrammarAST, type Grammar, GrammarUtils, RegExpUtils } from 'langium';
import { expandToNode, joinToNode, toString, type Generated } from 'langium/generate';
import type { LangiumLanguageConfig } from '../../package-types.js';
import { collectKeywords } from '../langium-util.js';

interface HighlightElement {
    pattern: string;
    greedy?: boolean;
}

type PrismHighlighter = Record<string, HighlightElement | HighlightElement[]>;

const idRegex = /^[a-zA-Z_]+$/;
export function generatePrismHighlighting(grammar: Grammar, config: LangiumLanguageConfig): string {
    const highlighter: PrismHighlighter = {};
    const keywords = collectKeywords(grammar);
    const terminals = getTerminals(grammar);
    const modifier = config.caseInsensitive ? 'i' : '';

    const commentTerminals = terminals.filter(GrammarUtils.isCommentTerminal);
    if (commentTerminals.length === 1) {
        highlighter.comment = {
            pattern: GrammarUtils.terminalRegex(commentTerminals[0]).toString(),
            greedy: true
        };
    } else if (commentTerminals.length > 0) {
        highlighter.comment = commentTerminals.map(e => ({
            pattern: GrammarUtils.terminalRegex(e).toString(),
            greedy: true
        }));
    }
    const stringTerminal = terminals.find(e => e.name.toLowerCase() === 'string');
    if (stringTerminal) {
        highlighter.string = {
            pattern: GrammarUtils.terminalRegex(stringTerminal).toString(),
            greedy: true
        };
    }
    const filteredKeywords = keywords.filter(e => idRegex.test(e)).sort((a, b) => b.length - a.length).map(RegExpUtils.escapeRegExp);
    highlighter.keyword = {
        pattern: `/\\b(${filteredKeywords.join('|')})\\b/${modifier}`
    };

    return generate(highlighter, config.id);
}

function generate(highlighter: PrismHighlighter, languageId: string): string {
    /* eslint-disable @typescript-eslint/indent */
    return toString(
        expandToNode`
            // This file is generated using a best effort guess for your language.
            // It is not guaranteed contain all expected prism syntax highlighting rules.
            // For more documentation, take a look at https://prismjs.com/extending.html'
            Prism.languages["${languageId}"] = {
                ${joinToNode(
                    Object.entries(highlighter),
                    ([name, value]) => {
                        const propertyName = !idRegex.test(name) ? `"${name}"` : name;
                        return Array.isArray(value) ? expandToNode`
                            ${propertyName}: [
                                ${joinToNode(value, generateElement, { separator: ',', appendNewLineIfNotEmpty: true })}
                            ]
                        ` : expandToNode`
                            ${propertyName}: ${generateElement(value)}
                        `;
                    },
                    { separator: ',', appendNewLineIfNotEmpty: true }
                )}
            };
        `.appendNewLine()
    );
    /* eslint-enable @typescript-eslint/indent */
}

function generateElement(element: HighlightElement): Generated {
    const props = [
        `pattern: ${element.pattern}`,
        element.greedy ? 'greedy: true' : undefined
    ].filter(Boolean);

    return expandToNode`
        {
            ${joinToNode(props, { separator: ',', appendNewLineIfNotEmpty: true })}
        }
    `;
}

function getTerminals(grammar: Grammar): GrammarAST.TerminalRule[] {
    return grammar.rules.filter(GrammarAST.isTerminalRule);
}
