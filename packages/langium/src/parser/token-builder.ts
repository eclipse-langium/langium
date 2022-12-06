/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Lexer, TokenPattern, TokenType, TokenVocabulary } from 'chevrotain';
import { AbstractRule, Grammar, isKeyword, isParserRule, isTerminalRule, Keyword, TerminalRule } from '../grammar/generated/ast';
import { terminalRegex } from '../grammar/internal-grammar-util';
import { streamAllContents } from '../utils/ast-util';
import { getAllReachableRules } from '../utils/grammar-util';
import { getCaseInsensitivePattern, isWhitespaceRegExp, partialMatches } from '../utils/regex-util';
import { Stream, stream } from '../utils/stream';

export interface TokenBuilderOptions {
    caseInsensitive?: boolean
}

export interface TokenBuilder {
    buildTokens(grammar: Grammar, options?: TokenBuilderOptions): TokenVocabulary;
}

export class DefaultTokenBuilder implements TokenBuilder {

    buildTokens(grammar: Grammar, options?: TokenBuilderOptions): TokenVocabulary {
        const reachableRules = stream(getAllReachableRules(grammar, false));
        const terminalTokens: TokenType[] = this.buildTerminalTokens(reachableRules);
        const tokens: TokenType[] = this.buildKeywordTokens(reachableRules, terminalTokens, options);

        terminalTokens.forEach(terminalToken => {
            const pattern = terminalToken.PATTERN;
            if (typeof pattern === 'object' && pattern && 'test' in pattern && isWhitespaceRegExp(pattern)) {
                tokens.unshift(terminalToken);
            } else {
                tokens.push(terminalToken);
            }
        });
        return tokens;
    }

    protected buildTerminalTokens(rules: Stream<AbstractRule>): TokenType[] {
        return rules.filter(isTerminalRule).filter(e => !e.fragment)
            .map(terminal => this.buildTerminalToken(terminal)).toArray();
    }

    protected buildTerminalToken(terminal: TerminalRule): TokenType {
        const regex = terminalRegex(terminal);
        const token: TokenType = { name: terminal.name, PATTERN: new RegExp(regex) };
        if (terminal.hidden) {
            // Only skip tokens that are able to accept whitespace
            token.GROUP = isWhitespaceRegExp(regex) ? Lexer.SKIPPED : 'hidden';
        }
        return token;
    }

    protected buildKeywordTokens(rules: Stream<AbstractRule>, terminalTokens: TokenType[], options?: TokenBuilderOptions): TokenType[] {
        return rules
            // We filter by parser rules, since keywords in terminal rules get transformed into regex and are not actual tokens
            .filter(isParserRule)
            .flatMap(rule => streamAllContents(rule).filter(isKeyword))
            .distinct(e => e.value).toArray()
            // Sort keywords by descending length
            .sort((a, b) => b.value.length - a.value.length)
            .map(keyword => this.buildKeywordToken(keyword, terminalTokens, Boolean(options?.caseInsensitive)));
    }

    protected buildKeywordToken(keyword: Keyword, terminalTokens: TokenType[], caseInsensitive: boolean): TokenType {
        return {
            name: keyword.value,
            PATTERN: this.buildKeywordPattern(keyword, caseInsensitive),
            LONGER_ALT: this.findLongerAlt(keyword, terminalTokens)
        };
    }

    protected buildKeywordPattern(keyword: Keyword, caseInsensitive: boolean): TokenPattern {
        return caseInsensitive ?
            new RegExp(getCaseInsensitivePattern(keyword.value)) :
            keyword.value;
    }

    protected findLongerAlt(keyword: Keyword, terminalTokens: TokenType[]): TokenType[] {
        return terminalTokens.reduce((longerAlts: TokenType[], token) => {
            const pattern = token?.PATTERN as RegExp;
            if (pattern?.source && partialMatches('^' + pattern.source + '$', keyword.value)) {
                longerAlts.push(token);
            }
            return longerAlts;
        }, []);
    }
}
