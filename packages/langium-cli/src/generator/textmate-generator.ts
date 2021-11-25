/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
import { escapeRegExp, getTerminalParts, isCommentTerminal, isTerminalRule, terminalRegex } from 'langium';
import { LangiumConfig } from '../package';
import { collectKeywords } from './util';

export interface TextMateGrammar {
    repository: Repository;
    readonly scopeName: string;
    readonly patterns: Pattern[];
    readonly injections?: { [expression: string]: Pattern };
    readonly injectionSelector?: string;
    readonly fileTypes?: string[];
    readonly name?: string;
    readonly firstLineMatch?: string;
}

export interface Repository {
    [name: string]: Pattern;
}

export interface Pattern {
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

export interface Captures {
    [captureId: string]: Pattern;
}

export function generateTextMate(grammar: langium.Grammar, config: LangiumConfig): string {
    const json: TextMateGrammar = {
        name: config.languageId,
        scopeName: `source.${config.languageId}`,
        fileTypes: config.fileExtensions ?? [],
        patterns: getPatterns(grammar, config),
        repository: getRepository(grammar, config)
    };

    return JSON.stringify(json, null, 2);
}

function getPatterns(grammar: langium.Grammar, config: LangiumConfig): Pattern[] {
    const patterns: Pattern[] = [];
    patterns.push({
        include: '#comments'
    });
    patterns.push(getControlKeywords(grammar, config));
    patterns.push(...getStringPatterns(grammar, config));
    return patterns;
}

function getRepository(grammar: langium.Grammar, config: LangiumConfig): Repository {
    const commentPatterns: Pattern[] = [];
    for (const rule of grammar.rules) {
        if (isTerminalRule(rule) && isCommentTerminal(rule)) {
            const parts = getTerminalParts(terminalRegex(rule));
            for (const part of parts) {
                if (part.end) {
                    commentPatterns.push({
                        'name': `comment.block.${config.languageId}`,
                        'begin': part.start,
                        'beginCaptures': {
                            '0': {
                                'name': `punctuation.definition.comment.${config.languageId}`
                            }
                        },
                        'end': part.end,
                        'endCaptures': {
                            '0': {
                                'name': `punctuation.definition.comment.${config.languageId}`
                            }
                        }
                    });
                } else {
                    commentPatterns.push({
                        'begin': part.start,
                        'beginCaptures': {
                            '1': {
                                'name': `punctuation.whitespace.comment.leading.${config.languageId}`
                            }
                        },
                        'end': '(?=$)',
                        'name': `comment.line.${config.languageId}`
                    });
                }
            }
        }
    }
    const repository: Repository = {
        'comments': {
            'patterns': commentPatterns
        }
    };

    return repository;
}

function getControlKeywords(grammar: langium.Grammar, pack: LangiumConfig): Pattern {
    const regex = /[A-Za-z]/;
    const controlKeywords = collectKeywords(grammar).filter(kw => regex.test(kw));
    const keywords = controlKeywords.map(escapeRegExp);
    const groups = groupKeywords(keywords);
    return {
        'name': `keyword.control.${pack.languageId}`,
        'match': groups.join('|')
    };
}

function groupKeywords(keywords: string[]): string[] {
    const groups: {
        letter: string[],
        leftSpecial: string[],
        rightSpecial: string[],
        special: string[]
    } = {letter: [], leftSpecial: [], rightSpecial: [], special: []};

    keywords.forEach(keyword => {
        if (/\w/.test(keyword[0])) {
            if (/\w/.test(keyword[keyword.length - 1])) {
                groups.letter.push(keyword);
            } else {
                groups.rightSpecial.push(keyword);
            }
        } else {
            if ((/\w/).test(keyword[keyword.length - 1])) {
                groups.leftSpecial.push(keyword);
            } else {
                groups.special.push(keyword);
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

function getStringPatterns(grammar: langium.Grammar, pack: LangiumConfig): Pattern[] {
    const terminals = langium.stream(grammar.rules).filter(langium.isTerminalRule);
    const stringTerminal = terminals.find(e => e.name.toLowerCase() === 'string');
    const stringPatterns: Pattern[] = [];
    if (stringTerminal) {
        const parts = getTerminalParts(terminalRegex(stringTerminal));
        for (const part of parts) {
            if (part.end) {
                stringPatterns.push({
                    'name': `string.quoted.${delimiterName(part.start)}.${pack.languageId}`,
                    'begin': part.start,
                    'end': part.end
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
