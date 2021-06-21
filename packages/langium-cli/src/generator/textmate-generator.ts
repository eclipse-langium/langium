/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as langium from 'langium';
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
        fileTypes: config.extensions ?? [],
        patterns: getPatterns(grammar, config),
        repository: getRepository(grammar, config)
    };

    return JSON.stringify(json, null, 2);
}

function getPatterns(grammar: langium.Grammar, config: LangiumConfig): Pattern[] {
    const patterns: Pattern[] = [];
    patterns.push(getKeywordControl(grammar, config));
    patterns.push(getKeywordSymbols(grammar, config));
    return patterns;
}

function getRepository(grammar: langium.Grammar, config: LangiumConfig): Repository {
    const repository: Repository = {
        'comments': {
            'patterns': [
                {
                    'name': `comment.block.${config.languageId}`,
                    'begin': '/\\*',
                    'beginCaptures': {
                        '0': {
                            'name': `punctuation.definition.comment.${config.languageId}`
                        }
                    },
                    'end': '\\*/',
                    'endCaptures': {
                        '0': {
                            'name': `punctuation.definition.comment.${config.languageId}`
                        }
                    }
                },
                {
                    'begin': '(^\\s+)?(?=//)',
                    'beginCaptures': {
                        '1': {
                            'name': 'punctuation.whitespace.comment.leading.cs'
                        }
                    },
                    'end': '(?=$)',
                    'name': `comment.line.${config.languageId}`
                }
            ]
        }
    };

    return repository;
}

function getKeywordControl(grammar: langium.Grammar, pack: LangiumConfig): Pattern {
    const regex = /[A-Za-z]+/;
    const keywords = collectKeywords(grammar).filter(kw => regex.test(kw)).map(kw => kw.replace(/'/g, ''));
    return {
        'name': `keyword.control.${pack.languageId}`,
        'match': `\\b(${keywords.join('|')})\\b`
    };
}
function getKeywordSymbols(grammar: langium.Grammar, pack: LangiumConfig): Pattern {
    const regex = /\W/;
    const keywordsFiltered = collectKeywords(grammar).map(kw => kw.replace(/'/g, '')).filter(kw => regex.test(kw));
    const keywords = keywordsFiltered.map(kw => `\\${kw}`);
    return {
        'name': `keyword.symbol.${pack.languageId}`,
        'match': `(${keywords.join('|')})`
    };
}

