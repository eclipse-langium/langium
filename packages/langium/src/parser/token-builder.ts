/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Lexer, TokenPattern, TokenType, TokenVocabulary } from 'chevrotain';
import { Grammar, isKeyword, isParserRule, isTerminalRule, Keyword, TerminalRule } from '../grammar/generated/ast';
import { terminalRegex } from '../grammar/grammar-util';
import { streamAllContents } from '../utils/ast-util';
import { getCaseInsensitivePattern, partialMatches } from '../utils/regex-util';
import { stream } from '../utils/stream';

export interface TokenBuilder {
    buildTokens(grammar: Grammar, options?: { caseInsensitive?: boolean }): TokenVocabulary;
}

export class DefaultTokenBuilder implements TokenBuilder {

    buildTokens(grammar: Grammar, options?: { caseInsensitive?: boolean }): TokenVocabulary {
        const terminalTokens: TokenType[] = this.buildTerminalTokens(grammar);
        const tokens: TokenType[] = this.buildKeywordTokens(grammar, terminalTokens, options);

        terminalTokens.forEach(terminalToken => {
            const pattern = terminalToken.PATTERN;
            (typeof pattern === 'object' && pattern && 'test' in pattern && pattern.test(' ')) ?
                tokens.unshift(terminalToken) :
                tokens.push(terminalToken);
        });
        return tokens;
    }

    protected buildTerminalTokens(grammar: Grammar): TokenType[] {
        return Array.from(stream(grammar.rules).filter(isTerminalRule)).filter(e => !e.fragment)
            .map(terminal => this.buildTerminalToken(terminal));
    }

    protected buildTerminalToken(terminal: TerminalRule): TokenType {
        let group: string | undefined;
        const regex = terminalRegex(terminal);
        if (terminal.hidden) {
            if (new RegExp(regex).test(' ')) { // Only skip tokens that are able to accept whitespace
                group = Lexer.SKIPPED;
            } else {
                group = 'hidden';
            }
        }

        const token = { name: terminal.name, GROUP: group, PATTERN: new RegExp(regex) };
        if (!group) {
            // 'undefined' is not a valid value for `GROUP`
            // Therefore, we have to delete it
            delete token.GROUP;
        }
        return token;
    }

    protected buildKeywordTokens(grammar: Grammar, terminalTokens: TokenType[], options?: { caseInsensitive?: boolean }): TokenType[] {
        // We filter by parser rules, since keywords in terminal rules get transformed into regex and are not actual tokens
        const parserRuleKeywords = grammar.rules.filter(isParserRule).flatMap(rule => streamAllContents(rule).filter(isKeyword).toArray());
        return stream(parserRuleKeywords).distinct(e => e.value).toArray()
            // Sort keywords by descending length
            .sort((a, b) => b.value.length - a.value.length)
            .reduce(
                (keywordTokens: TokenType[], keyword: Keyword) => {
                    keywordTokens.push(this.buildKeywordToken(keyword, keywordTokens, terminalTokens, !!options?.caseInsensitive));
                    return keywordTokens;
                }, []);
    }

    protected buildKeywordToken(keyword: Keyword, keywordTokens: TokenType[], terminalTokens: TokenType[], caseInsensitive: boolean): TokenType {
        const longerAlt = this.findLongerAlt(keyword, keywordTokens, terminalTokens);
        return { name: keyword.value, PATTERN: this.buildKeywordPattern(keyword, caseInsensitive), LONGER_ALT: longerAlt };
    }

    protected buildKeywordPattern(keyword: Keyword, caseInsensitive: boolean): TokenPattern {
        return caseInsensitive ?
            new RegExp(getCaseInsensitivePattern(keyword.value)) :
            keyword.value;
    }

    protected findLongerAlt(keyword: Keyword, keywordTokens: TokenType[], terminalTokens: TokenType[]): TokenType[] {
        const longerAlts: TokenType[] = [];
        keywordTokens.forEach(token => {
            if (token.name.length > keyword.value.length && token.name.startsWith(keyword.value)) {
                longerAlts.push(token);
            }
        });
        terminalTokens.forEach(token => {
            const pattern = token?.PATTERN as RegExp;
            if (pattern?.source && partialMatches('^' + pattern.source + '$', keyword.value)) {
                longerAlts.push(token);
            }
        });
        return longerAlts;
    }
}
