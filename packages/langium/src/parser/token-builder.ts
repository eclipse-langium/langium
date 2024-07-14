/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CustomPatternMatcherFunc, TokenPattern, TokenType, TokenVocabulary } from 'chevrotain';
import type { AbstractRule, Grammar, Keyword, TerminalRule } from '../languages/generated/ast.js';
import type { Stream } from '../utils/stream.js';
import { Lexer } from 'chevrotain';
import { isKeyword, isParserRule, isTerminalRule } from '../languages/generated/ast.js';
import { streamAllContents } from '../utils/ast-utils.js';
import { getAllReachableRules, terminalRegex } from '../utils/grammar-utils.js';
import { getCaseInsensitivePattern, isWhitespace, partialMatches } from '../utils/regexp-utils.js';
import { stream } from '../utils/stream.js';

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
            if (typeof pattern === 'object' && pattern && 'test' in pattern && isWhitespace(pattern)) {
                tokens.unshift(terminalToken);
            } else {
                tokens.push(terminalToken);
            }
        });
        // We don't need to add the EOF token explicitly.
        // It is automatically available at the end of the token stream.
        return tokens;
    }

    protected buildTerminalTokens(rules: Stream<AbstractRule>): TokenType[] {
        return rules.filter(isTerminalRule).filter(e => !e.fragment)
            .map(terminal => this.buildTerminalToken(terminal)).toArray();
    }

    protected buildTerminalToken(terminal: TerminalRule): TokenType {
        const regex = terminalRegex(terminal);
        const pattern = this.requiresCustomPattern(regex) ? this.regexPatternFunction(regex) : regex;
        const tokenType: TokenType = {
            name: terminal.name,
            PATTERN: pattern,
            LINE_BREAKS: true
        };
        if (terminal.hidden) {
            // Only skip tokens that are able to accept whitespace
            tokenType.GROUP = isWhitespace(regex) ? Lexer.SKIPPED : 'hidden';
        }
        return tokenType;
    }

    protected requiresCustomPattern(regex: RegExp): boolean {
        if (regex.flags.includes('u')) {
            // Unicode regexes are not supported by Chevrotain.
            return true;
        } else if (regex.source.includes('?<=') || regex.source.includes('?<!')) {
            // Negative and positive lookbehind are not supported by Chevrotain yet.
            return true;
        } else {
            return false;
        }
    }

    protected regexPatternFunction(regex: RegExp): CustomPatternMatcherFunc {
        const stickyRegex = new RegExp(regex, regex.flags + 'y');
        return (text, offset) => {
            stickyRegex.lastIndex = offset;
            const execResult = stickyRegex.exec(text);
            return execResult;
        };
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


export interface IndentationTokenBuilderOptions {
    /**
     * The name of the token used to denote indentation in the grammar.
     * A possible definition in the grammar could look like this:
     * ```langium
     * terminal INDENT: ':synthetic-indent:';
     * ```
     *
     * @default 'INDENT'
     */
    indentTokenName: string;
    /**
     * The name of the token used to denote deindentation in the grammar.
     * A possible definition in the grammar could look like this:
     * ```langium
     * terminal DEDENT: ':synthetic-dedent:';
     * ```
     *
     * @default 'DEDENT'
     */
    dedentTokenName: string;
    /**
     * The name of the token used to denote whitespace other than indentation and newlines in the grammar.
     * A possible definition in the grammar could look like this:
     * ```langium
     * hidden terminal WS: /[ \t]+/;
     * ```
     *
     * @default 'WS'
     */
    whitespaceTokenName: string;
}

const indetationBuilderDefaultOptions: IndentationTokenBuilderOptions = {
    indentTokenName: 'INDENT',
    dedentTokenName: 'DEDENT',
    whitespaceTokenName: 'WS',
};

/**
 * A token builder that is sensitive to indentation in the input text.
 * It will generate tokens for indentation and dedentation based on the indentation level.
 *
 * Inspired by https://github.com/chevrotain/chevrotain/blob/master/examples/lexer/python_indentation/python_indentation.js
 */
export class IndentationAwareTokenBuilder extends DefaultTokenBuilder {
    private indentationStack: number[] = [0];
    private options: IndentationTokenBuilderOptions;

    /**
     * The token type to be used for indentation tokens
     */
    protected indentTokenType: TokenType;

    /**
     * The token type to be used for dedentation tokens
     */
    protected dedentTokenType: TokenType;

    /**
     * A regular expression to match a series of tabs and/or spaces.
     * Override this to customize what the indentation is allowed to consist of.
     */
    protected whitespaceRegExp = /[ \t]+/y;

    constructor(options: Partial<IndentationTokenBuilderOptions> = indetationBuilderDefaultOptions) {
        super();
        this.options = {
            ...indetationBuilderDefaultOptions,
            ...options,
        };

        this.indentTokenType = createToken({
            name: this.options.indentTokenName,
            pattern: this.indentMatcher,
            line_breaks: false,
        });

        this.dedentTokenType = createToken({
            name: this.options.dedentTokenName,
            pattern: this.dedentMatcher,
            line_breaks: false,
        });
    }

    override buildTokens(grammar: GrammarAST.Grammar, options?: TokenBuilderOptions | undefined) {
        const tokenTypes = super.buildTokens(grammar, options);
        if (!isTokenTypeArray(tokenTypes)) {
            throw new Error('Invalid tokens built by default builder');
        }

        const {indentTokenName, dedentTokenName, whitespaceTokenName} = this.options;

        // Rearrange tokens because whitespace (which is ignored) goes to the beginning by default, consuming indentation as well
        // Order should be: dedent, indent, spaces
        const dedent = tokenTypes.find(tok => tok.name === dedentTokenName);
        const indent = tokenTypes.find(tok => tok.name === indentTokenName);
        const ws = tokenTypes.find(tok => tok.name === whitespaceTokenName);
        if (!dedent || !indent || !ws) {
            throw new Error('Some indentation/whitespace tokens not found!');
        }

        const spaceTokens = [dedent, indent, ws];
        const otherTokens = tokenTypes.filter(tok => !spaceTokens.includes(tok));
        return [...spaceTokens, ...otherTokens];
    }

    private isStartOfLine(text: string, offset: number): boolean {
        return offset === 0 || '\r\n'.includes(text[offset - 1]);
    }

    private matchWhitespace(text: string, offset: number) {
        this.whitespaceRegExp.lastIndex = offset;
        const match = this.whitespaceRegExp.exec(text);
        return {
            currIndentLevel: match?.[0].length ?? 0,
            prevIndentLevel: this.indentationStack.at(-1)!,
            match,
        };
    }

    private createIndentationTokenInstance(tokenType: TokenType, text: string, image: string, offset: number) {
        const lineNumber = text.substring(0, offset).split(/\r\n|\r|\n/).length;
        return createTokenInstance(
            tokenType,
            image,
            offset, offset + image.length,
            lineNumber, lineNumber,
            0, image.length,
        );
    }

    /**
     * A custom pattern for matching indents
     *
     * @param text The full input string.
     * @param offset The offset at which to attempt a match
     * @param tokens Previously scanned Tokens
     * @param groups Token Groups
     */
    protected indentMatcher: CustomPatternMatcherFunc = (text, offset, tokens, groups) => {
        const {indentTokenName} = this.options;

        if (!this.isStartOfLine(text, offset)) {
            return null;
        }

        const {currIndentLevel, prevIndentLevel, match} = this.matchWhitespace(text, offset);

        if (currIndentLevel <= prevIndentLevel) {
            // shallower indentation (should be matched by dedent)
            // or same indentation level (should be matched by whitespace and ignored)
            return null;
        }

        this.indentationStack.push(currIndentLevel);

        const indentToken = this.createIndentationTokenInstance(
            this.indentTokenType,
            text,
            match?.[0] ?? indentTokenName,
            offset,
        );
        tokens.push(indentToken);

        // Token already added, let the indentation now be consumed as whitespace and ignored
        return null;
    };

    /**
     * A custom pattern for matching dedents
     *
     * @param text The full input string.
     * @param offset The offset at which to attempt a match
     * @param tokens Previously scanned Tokens
     * @param groups Token Groups
     */
    protected dedentMatcher: CustomPatternMatcherFunc = (text, offset, tokens, groups) => {
        const {dedentTokenName} = this.options;

        if (!this.isStartOfLine(text, offset)) {
            return null;
        }

        const {currIndentLevel, prevIndentLevel, match} = this.matchWhitespace(text, offset);

        if (currIndentLevel >= prevIndentLevel) {
            // bigger indentation (should be matched by indent)
            // or same indentation level (should be matched by whitespace and ignored)
            return null;
        }

        const matchIndentIndex = this.indentationStack.lastIndexOf(currIndentLevel);

        // Any dedent must match some previous indentation level.
        if (matchIndentIndex === -1) {
            console.error(`Invalid dedent level ${currIndentLevel} at offset: ${offset}. Current indetation stack: ${this.indentationStack}`);
            // throwing an error would crash the language server
            // TODO: find a way to report error diagnostics message
            return null;
        }

        const numberOfDedents = this.indentationStack.length - matchIndentIndex - 1;

        for (let i = 0; i < numberOfDedents; i++) {
            const token = this.createIndentationTokenInstance(
                this.dedentTokenType,
                text,
                match?.[0] ?? dedentTokenName,
                offset,
            );
            tokens.push(token);
            this.indentationStack.pop();
        }

        // Token already added, let the dedentation now be consumed as whitespace and ignored
        return null;
    };

    protected override buildTerminalToken(terminal: GrammarAST.TerminalRule): TokenType {
        const tokenType = super.buildTerminalToken(terminal);
        const {indentTokenName, dedentTokenName, whitespaceTokenName} = this.options;

        if (tokenType.name === indentTokenName) {
            return this.indentTokenType;
        } else if (tokenType.name === dedentTokenName) {
            return this.dedentTokenType;
        } else if (tokenType.name === whitespaceTokenName) {
            return createToken({
                name: whitespaceTokenName,
                pattern: this.whitespaceRegExp,
                group: Lexer.SKIPPED,
            });
        }

        return tokenType;
    }

    /**
     * Resets the indentation stack between different runs of the lexer
     *
     * @param text Full text that was tokenized
     * @returns Remaining dedent tokens to match all previous indents at the end of the file
     */
    public popRemainingDedents(text: string) {
        const remainingDedents: IToken[] = [];
        while (this.indentationStack.length > 1) {
            remainingDedents.push(
                this.createIndentationTokenInstance(this.dedentTokenType, text, this.options.dedentTokenName, text.length)
            );
            this.indentationStack.pop();
        }

        this.indentationStack = [0];
        return remainingDedents;
    }
}
