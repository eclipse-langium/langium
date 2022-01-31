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

    // We need suffixes for terminals and keywords which have the same name
    protected readonly KEYWORD_SUFFIX = '_KEYWORD';
    protected readonly TERMINAL_SUFFIX = '_TERMINAL';

    buildTokens(grammar: Grammar, options?: { caseInsensitive?: boolean }): TokenVocabulary {
        const tokenMap = new Map<string, TokenType>();
        const terminalsTokens: TokenType[] = [];
        const terminals = Array.from(stream(grammar.rules).filter(isTerminalRule)).filter(e => !e.fragment);
        for (const terminal of terminals) {
            const token = this.buildTerminalToken(terminal);
            terminalsTokens.push(token);
            tokenMap.set(terminal.name + this.TERMINAL_SUFFIX, token);
        }

        const tokens: TokenType[] = [];
        // We filter by parser rules, since keywords in terminal rules get transformed into regex and are not actual tokens
        const parserRuleKeywords = grammar.rules.filter(isParserRule).flatMap(rule => streamAllContents(rule).filter(isKeyword).toArray());
        const keywords = stream(parserRuleKeywords).distinct(e => e.value).toArray()
            // Sort keywords by descending length
            .sort((a, b) => b.value.length - a.value.length);

        for (const keyword of keywords) {
            const keywordToken = this.buildKeywordToken(keyword, keywords, terminals, tokenMap, !!options?.caseInsensitive);
            tokens.push(keywordToken);
            tokenMap.set(keyword.value + this.KEYWORD_SUFFIX, keywordToken);
        }

        for (const terminalToken of terminalsTokens) {
            const pattern = terminalToken.PATTERN;
            if (typeof pattern === 'object' && pattern && 'test' in pattern && pattern.test(' ')) {
                tokens.unshift(terminalToken);
            } else {
                tokens.push(terminalToken);
            }
        }

        return tokens;
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

    protected buildKeywordToken(keyword: Keyword, keywords: Keyword[], terminals: TerminalRule[], tokenMap: Map<string, TokenType>, caseInsensitive: boolean): TokenType {
        const longerAlt = this.findLongerAlt(keyword, keywords, terminals, tokenMap);
        return { name: keyword.value, PATTERN: this.buildKeywordPattern(keyword, caseInsensitive), LONGER_ALT: longerAlt };
    }

    protected buildKeywordPattern(keyword: Keyword, caseInsensitive: boolean): TokenPattern {
        return caseInsensitive ?
            new RegExp(getCaseInsensitivePattern(keyword.value)) :
            keyword.value;
    }

    protected findLongerAlt(keyword: Keyword, keywords: Keyword[], terminals: TerminalRule[], tokenMap: Map<string, TokenType>): TokenType[] {
        const longerAlts: TokenType[] = [];
        for (const otherKeyword of keywords) {
            const tokenType = tokenMap.get(otherKeyword.value + this.KEYWORD_SUFFIX);
            if (tokenType && otherKeyword.value.length > keyword.value.length && otherKeyword.value.startsWith(keyword.value)) {
                longerAlts.push(tokenType);
            }
        }
        for (const terminal of terminals) {
            const tokenType = tokenMap.get(terminal.name + this.TERMINAL_SUFFIX);
            if (tokenType && partialMatches('^' + terminalRegex(terminal) + '$', keyword.value)) {
                longerAlts.push(tokenType);
            }
        }
        return longerAlts;
    }
}
