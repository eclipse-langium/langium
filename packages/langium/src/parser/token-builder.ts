/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Lexer, TokenPattern, TokenType } from 'chevrotain';
import { Grammar, isKeyword, isTerminalRule, TerminalRule } from '../grammar/generated/ast';
import { streamAllContents } from '../utils/ast-util';
import { partialMatches } from '../utils/regex-util';
import { stream } from '../utils/stream';

export interface TokenBuilder {
    buildTokens(grammar: Grammar): TokenType[];
}

export class DefaultTokenBuilder implements TokenBuilder {

    buildTokens(grammar: Grammar): TokenType[] {
        const map = new Map<string, TokenType>();
        const terminals = Array.from(stream(grammar.rules).filterType(isTerminalRule));
        for (const terminal of terminals) {
            const token = this.buildTerminalToken(grammar, terminal);
            map.set(terminal.name, token);
        }

        const tokens: TokenType[] = [];
        const keywordTokens = new Map<string, TokenType>();

        streamAllContents(grammar).forEach(e => {
            const node = e.node;
            if (isKeyword(node)) {
                const keyword = this.buildKeywordToken(node.value, terminals, map);
                keywordTokens.set(node.value, keyword);
            }
        });

        let sortedKeywords = Array.from(keywordTokens.values());
        sortedKeywords = sortedKeywords.sort((a, b) => a.name.localeCompare(b.name)).sort((a, b) => {
            const ap = a.PATTERN as string;
            const bp = b.PATTERN as string;
            return bp.length - ap.length;
        });
        tokens.push(...sortedKeywords);

        for (const terminalToken of map.values()) {
            const pattern = terminalToken.PATTERN;
            if (typeof pattern === 'object' && pattern && 'test' in pattern && pattern.test(' ')) {
                tokens.unshift(terminalToken);
            } else {
                tokens.push(terminalToken);
            }
        }

        return tokens;
    }

    protected buildTerminalToken(grammar: Grammar, terminal: TerminalRule): TokenType {
        let group: string | undefined;
        if (grammar.hiddenTokens && grammar.hiddenTokens.map(e => e.ref).includes(terminal)) {
            if (new RegExp(terminal.regex).test(' ')) { // Only skip tokens that are able to accept whitespace
                group = Lexer.SKIPPED;
            } else {
                group = 'hidden';
            }
        }

        const token = { name: terminal.name, GROUP: group, PATTERN: new RegExp(terminal.regex) };
        if (!group) {
            // 'undefined' is not a valid value for `GROUP`
            // Therefore, we have to delete it
            delete token.GROUP;
        }
        return token;
    }

    protected buildKeywordToken(keyword: string, terminals: TerminalRule[], tokenMap: Map<string, TokenType>): TokenType {
        const longerAlt = this.findLongerAlt(keyword, terminals, tokenMap);
        return { name: keyword, PATTERN: this.buildKeywordPattern(keyword), LONGER_ALT: longerAlt };
    }

    protected buildKeywordPattern(keyword: string): TokenPattern {
        return keyword;
    }

    protected findLongerAlt(keyword: string, terminals: TerminalRule[], tokenMap: Map<string, TokenType>): TokenType | undefined {
        for (const terminal of terminals) {
            if (partialMatches('^' + terminal.regex, keyword)) {
                return tokenMap.get(terminal.name);
            }
        }
        return undefined;
    }
}
