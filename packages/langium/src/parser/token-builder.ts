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
            if (typeof pattern === 'object' && pattern && 'test' in pattern && pattern.test(' ')) {
                tokens.unshift(terminalToken);
            } else {
                tokens.push(terminalToken);
            }
        });
        return tokens;
    }

    protected buildTerminalTokens(grammar: Grammar): TokenType[] {
        return grammar.rules.filter(isTerminalRule).filter(e => !e.fragment)
            .map(terminal => this.buildTerminalToken(terminal));
    }

    protected buildTerminalToken(terminal: TerminalRule): TokenType {
        let group: string | undefined;
        const regex = terminalRegex(terminal);
        if (terminal.hidden) {
            // Only skip tokens that are able to accept whitespace
            group = new RegExp(regex).test(' ') ? Lexer.SKIPPED : 'hidden';
        }

        const token = { name: terminal.name, GROUP: group, PATTERN: new RegExp(regex) };
        if (!group) {
            // 'undefined' is not a valid value for `GROUP`; therefore, we have to delete it
            delete token.GROUP;
        }
        return token;
    }

    protected buildKeywordTokens(grammar: Grammar, terminalTokens: TokenType[], options?: { caseInsensitive?: boolean }): TokenType[] {
        return stream(grammar.rules)
            // We filter by parser rules, since keywords in terminal rules get transformed into regex and are not actual tokens
            .filter(isParserRule)
            .flatMap(rule => streamAllContents(rule).filter(isKeyword))
            .distinct(e => e.value).toArray()
            // Sort keywords by descending length
            .sort((a, b) => b.value.length - a.value.length)
            .map(keyword => this.buildKeywordToken(keyword, terminalTokens, !!options?.caseInsensitive));
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
        return terminalTokens.reduce((longerAlts: TokenType[], token: TokenType) => {
            const pattern = token?.PATTERN as RegExp;
            if (pattern?.source && partialMatches('^' + pattern.source + '$', keyword.value)) {
                longerAlts.push(token);
            }
            return longerAlts;
        }, []);
    }
}
