/******************************************************************************
 * Copyright 2021-2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
******************************************************************************/
import type { Grammar } from 'langium';
import { GrammarAST, GrammarUtils, RegExpUtils, stream } from 'langium';
import type { LangiumLanguageConfig } from '../../package-types.js';
import { collectKeywords } from '../langium-util.js';

/* eslint-disable dot-notation */

interface TextMateGrammar {
    repository: Repository;
    readonly scopeName: string;
    readonly patterns: Pattern[];
    readonly injections?: { [expression: string]: Pattern };
    readonly injectionSelector?: string;
    readonly fileTypes?: string[];
    readonly name?: string;
    readonly firstLineMatch?: string;
}

interface Repository {
    [name: string]: Pattern;
}

interface Pattern {
    id?: number;
    readonly include?: string;
    readonly name?: string;
    readonly contentName?: string;
    readonly match?: string;
    readonly captures?: Captures;
    readonly begin?: string;
    readonly beginCaptures?: Captures;
    readonly end?: string;
    readonly endCaptures?: Captures;
    readonly while?: string;
    readonly whileCaptures?: Captures;
    readonly patterns?: Pattern[];
    readonly repository?: Repository;
    readonly applyEndPatternLast?: boolean;
}

interface Captures {
    [captureId: string]: Pattern;
}

export function generateTextMate(grammar: Grammar, config: LangiumLanguageConfig): string {
    const json: TextMateGrammar = {
        name: config.id,
        scopeName: `source.${config.id}`,
        fileTypes: config.fileExtensions ?? [],
        patterns: getPatterns(grammar, config),
        repository: getRepository(grammar, config)
    };

    return JSON.stringify(json, null, 2) + '\n';
}

function getPatterns(grammar: Grammar, config: LangiumLanguageConfig): Pattern[] {
    const patterns: Pattern[] = [];
    patterns.push({
        include: '#comments'
    });
    patterns.push(getControlKeywords(grammar, config));
    patterns.push(...getStringPatterns(grammar, config));
    return patterns;
}

function getRepository(grammar: Grammar, config: LangiumLanguageConfig): Repository {
    const repository: Repository = {};
    const commentPatterns: Pattern[] = [];
    let stringEscapePattern: Pattern | undefined;
    for (const rule of grammar.rules) {
        if (GrammarAST.isTerminalRule(rule) && GrammarUtils.isCommentTerminal(rule)) {
            const parts = RegExpUtils.getTerminalParts(GrammarUtils.terminalRegex(rule));
            for (const part of parts) {
                if (part.end) {
                    commentPatterns.push({
                        'name': `comment.block.${config.id}`,
                        'begin': part.start,
                        'beginCaptures': {
                            '0': {
                                'name': `punctuation.definition.comment.${config.id}`
                            }
                        },
                        'end': part.end,
                        'endCaptures': {
                            '0': {
                                'name': `punctuation.definition.comment.${config.id}`
                            }
                        }
                    });
                } else {
                    commentPatterns.push({
                        'begin': part.start,
                        'beginCaptures': {
                            '1': {
                                'name': `punctuation.whitespace.comment.leading.${config.id}`
                            }
                        },
                        'end': '(?=$)',
                        'name': `comment.line.${config.id}`
                    });
                }
            }
        } else if (GrammarAST.isTerminalRule(rule) && rule.name.toLowerCase() === 'string') {
            stringEscapePattern = {
                'name': `constant.character.escape.${config.id}`,
                'match': '\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|u\\{[0-9A-Fa-f]+\\}|[0-2][0-7]{0,2}|3[0-6][0-7]?|37[0-7]?|[4-7][0-7]?|.|$)'
            };
        }
    }

    if (commentPatterns.length > 0) {
        repository['comments'] = {
            'patterns': commentPatterns
        };
    }
    if (stringEscapePattern) {
        repository['string-character-escape'] = stringEscapePattern;
    }
    return repository;
}

function getControlKeywords(grammar: Grammar, pack: LangiumLanguageConfig): Pattern {
    const regex = /[A-Za-z]/;
    const controlKeywords = collectKeywords(grammar).filter(kw => regex.test(kw));
    const groups = groupKeywords(controlKeywords, pack.caseInsensitive);
    return {
        'name': `keyword.control.${pack.id}`,
        'match': groups.join('|')
    };
}

function groupKeywords(keywords: string[], caseInsensitive: boolean | undefined): string[] {
    const groups: {
        letter: string[],
        leftSpecial: string[],
        rightSpecial: string[],
        special: string[];
    } = { letter: [], leftSpecial: [], rightSpecial: [], special: [] };

    keywords.forEach(keyword => {
        const keywordPattern = caseInsensitive ? RegExpUtils.getCaseInsensitivePattern(keyword) : RegExpUtils.escapeRegExp(keyword);
        if (/\w/.test(keyword[0])) {
            if (/\w/.test(keyword[keyword.length - 1])) {
                groups.letter.push(keywordPattern);
            } else {
                groups.rightSpecial.push(keywordPattern);
            }
        } else {
            if ((/\w/).test(keyword[keyword.length - 1])) {
                groups.leftSpecial.push(keywordPattern);
            } else {
                groups.special.push(keywordPattern);
            }
        }
    });

    const res = [];
    if (groups.letter.length) res.push(`\\b(${groups.letter.join('|')})\\b`);
    if (groups.leftSpecial.length) res.push(`\\B(${groups.leftSpecial.join('|')})\\b`);
    if (groups.rightSpecial.length) res.push(`\\b(${groups.rightSpecial.join('|')})\\B`);
    if (groups.special.length) res.push(`\\B(${groups.special.join('|')})\\B`);
    return res;
}

function getStringPatterns(grammar: Grammar, pack: LangiumLanguageConfig): Pattern[] {
    const terminals = stream(grammar.rules).filter(GrammarAST.isTerminalRule);
    const stringTerminal = terminals.find(e => e.name.toLowerCase() === 'string');
    const stringPatterns: Pattern[] = [];
    if (stringTerminal) {
        const parts = RegExpUtils.getTerminalParts(GrammarUtils.terminalRegex(stringTerminal));
        for (const part of parts) {
            if (part.end) {
                stringPatterns.push({
                    'name': `string.quoted.${delimiterName(part.start)}.${pack.id}`,
                    'begin': part.start,
                    'end': part.end,
                    'patterns': [
                        {
                            'include': '#string-character-escape'
                        }
                    ]
                });
            }
        }
    }
    return stringPatterns;
}

function delimiterName(delimiter: string): string {
    if (delimiter === "'") {
        return 'single';
    } else if (delimiter === '"') {
        return 'double';
    } else if (delimiter === '`') {
        return 'backtick';
    } else {
        return 'delimiter';
    }
}
