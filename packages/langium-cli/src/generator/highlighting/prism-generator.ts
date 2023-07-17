/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar } from 'langium';
import type { LangiumLanguageConfig } from '../../package.js';
import { CompositeGeneratorNode, escapeRegExp, GrammarAST, isCommentTerminal, NL, toString } from 'langium';
import { terminalRegex } from 'langium/internal';
import _ from 'lodash';
import { collectKeywords } from '../util.js';

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

    const commentTerminals = terminals.filter(isCommentTerminal);
    if (commentTerminals.length === 1) {
        highlighter.comment = {
            pattern: terminalRegex(commentTerminals[0]).toString(),
            greedy: true
        };
    } else if (commentTerminals.length > 0) {
        highlighter.comment = commentTerminals.map(e => ({
            pattern: terminalRegex(e).toString(),
            greedy: true
        }));
    }
    const stringTerminal = terminals.find(e => e.name.toLowerCase() === 'string');
    if (stringTerminal) {
        highlighter.string = {
            pattern: terminalRegex(stringTerminal).toString(),
            greedy: true
        };
    }
    const filteredKeywords = keywords.filter(e => idRegex.test(e)).sort((a, b) => b.length - a.length).map(escapeRegExp);
    highlighter.keyword = {
        pattern: `/\\b(${filteredKeywords.join('|')})\\b/${modifier}`
    };

    return generate(highlighter, grammar.name ?? 'unknown');
}

function generate(highlighter: PrismHighlighter, grammarName: string): string {
    const generatorNode = new CompositeGeneratorNode(
        '// This file is generated using a best effort guess for your language.', NL,
        '// It is not guaranteed contain all expected prism syntax highlighting rules.', NL,
        '// For more documentation, take a look at https://prismjs.com/extending.html', NL,
        'Prism.languages.', _.camelCase(grammarName), ' = {', NL
    );
    generatorNode.indent(propertyIndent => {
        for (const [name, value] of Object.entries(highlighter)) {
            let propertyName = name;
            if (!idRegex.test(name)) {
                propertyName = `"${name}"`;
            }
            propertyIndent.append(propertyName, ': ');
            if (Array.isArray(value)) {
                propertyIndent.append('[', NL);
                propertyIndent.indent(arrayIndent => {
                    for (const element of value) {
                        generateElement(arrayIndent, element);
                    }
                });
                propertyIndent.append('],', NL);
            } else {
                generateElement(propertyIndent, value);
            }
        }
    });
    generatorNode.append('};', NL);
    return toString(generatorNode);
}

function generateElement(node: CompositeGeneratorNode, element: HighlightElement): void {
    node.append('{', NL);
    node.indent(objectIndent => {
        objectIndent.append('pattern: ', element.pattern);
        if (element.greedy) {
            objectIndent.append(',', NL, 'greedy: true');
        }
        objectIndent.append(NL);
    });
    node.append('},', NL);
}

function getTerminals(grammar: Grammar): GrammarAST.TerminalRule[] {
    return grammar.rules.filter(GrammarAST.isTerminalRule);
}
