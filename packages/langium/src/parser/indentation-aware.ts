/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CustomPatternMatcherFunc, TokenType, IToken } from 'chevrotain';
import type { Grammar, TerminalRule } from '../languages/generated/ast.js';
import type { TokenBuilderOptions } from './token-builder.js';
import type { LexerResult } from './lexer.js';
import type { LangiumCoreServices } from '../services.js';
import { createToken, createTokenInstance, Lexer } from 'chevrotain';
import { DefaultTokenBuilder } from './token-builder.js';
import { DefaultLexer, isTokenTypeArray } from './lexer.js';

export interface IndentationTokenBuilderOptions<TokenName extends string = string> {
    /**
     * The name of the token used to denote indentation in the grammar.
     * A possible definition in the grammar could look like this:
     * ```langium
     * terminal INDENT: ':synthetic-indent:';
     * ```
     *
     * @default 'INDENT'
     */
    indentTokenName: TokenName;
    /**
     * The name of the token used to denote deindentation in the grammar.
     * A possible definition in the grammar could look like this:
     * ```langium
     * terminal DEDENT: ':synthetic-dedent:';
     * ```
     *
     * @default 'DEDENT'
     */
    dedentTokenName: TokenName;
    /**
     * The name of the token used to denote whitespace other than indentation and newlines in the grammar.
     * A possible definition in the grammar could look like this:
     * ```langium
     * hidden terminal WS: /[ \t]+/;
     * ```
     *
     * @default 'WS'
     */
    whitespaceTokenName: TokenName;
}

export const indentationBuilderDefaultOptions: IndentationTokenBuilderOptions = {
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
export class IndentationAwareTokenBuilder<Terminals extends string = string> extends DefaultTokenBuilder {
    /**
     * The stack in which all the previous matched indentation levels are stored
     * to understand how deep a the next tokens are nested.
     */
    protected indentationStack: number[] = [0];
    readonly options: IndentationTokenBuilderOptions<Terminals>;

    /**
     * The token type to be used for indentation tokens
     */
    readonly indentTokenType: TokenType;

    /**
     * The token type to be used for dedentation tokens
     */
    readonly dedentTokenType: TokenType;

    /**
     * A regular expression to match a series of tabs and/or spaces.
     * Override this to customize what the indentation is allowed to consist of.
     */
    protected whitespaceRegExp = /[ \t]+/y;

    constructor(options: Partial<IndentationTokenBuilderOptions<NoInfer<Terminals>>> = indentationBuilderDefaultOptions as IndentationTokenBuilderOptions<Terminals>) {
        super();
        this.options = {
            ...indentationBuilderDefaultOptions as IndentationTokenBuilderOptions<Terminals>,
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

    override buildTokens(grammar: Grammar, options?: TokenBuilderOptions | undefined) {
        const tokenTypes = super.buildTokens(grammar, options);
        if (!isTokenTypeArray(tokenTypes)) {
            throw new Error('Invalid tokens built by default builder');
        }

        const { indentTokenName, dedentTokenName, whitespaceTokenName } = this.options;

        // Rearrange tokens because whitespace (which is ignored) goes to the beginning by default, consuming indentation as well
        // Order should be: dedent, indent, spaces
        let dedent: TokenType | undefined;
        let indent: TokenType | undefined;
        let ws: TokenType | undefined;
        const otherTokens: TokenType[] = [];
        for (const tokenType of tokenTypes) {
            if (tokenType.name === dedentTokenName) {
                dedent = tokenType;
            } else if (tokenType.name === indentTokenName) {
                indent = tokenType;
            } else if (tokenType.name === whitespaceTokenName) {
                ws = tokenType;
            } else {
                otherTokens.push(tokenType);
            }
        }
        if (!dedent || !indent || !ws) {
            throw new Error('Some indentation/whitespace tokens not found!');
        }
        return [dedent, indent, ws, ...otherTokens];
    }

    /**
     * Helper function to check if the current position is the start of a new line.
     *
     * @param text The full input string.
     * @param offset The current position at which to check
     * @returns Whether the current position is the start of a new line
     */
    protected isStartOfLine(text: string, offset: number): boolean {
        return offset === 0 || '\r\n'.includes(text[offset - 1]);
    }

    /**
     * A helper function used in matching both indents and dedents.
     *
     * @param text The full input string.
     * @param offset The current position at which to attempt a match
     * @returns The current and previous indentation levels and the matched whitespace
     */
    protected matchWhitespace(text: string, offset: number) {
        this.whitespaceRegExp.lastIndex = offset;
        const match = this.whitespaceRegExp.exec(text);
        return {
            currIndentLevel: match?.[0].length ?? 0,
            prevIndentLevel: this.indentationStack.at(-1)!,
            match,
        };
    }

    /**
     * Helper function to create an instance of an indentation token.
     *
     * @param tokenType Indent or dedent token type
     * @param text Full input string, used to calculate the line number
     * @param image The original image of the token (tabs or spaces)
     * @param offset Current position in the input string
     * @returns The indentation token instance
     */
    protected createIndentationTokenInstance(tokenType: TokenType, text: string, image: string, offset: number) {
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
    protected indentMatcher: CustomPatternMatcherFunc = (text, offset, tokens, _groups) => {
        const { indentTokenName } = this.options;

        if (!this.isStartOfLine(text, offset)) {
            return null;
        }

        const { currIndentLevel, prevIndentLevel, match } = this.matchWhitespace(text, offset);

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
    protected dedentMatcher: CustomPatternMatcherFunc = (text, offset, tokens, _groups) => {
        const { dedentTokenName } = this.options;

        if (!this.isStartOfLine(text, offset)) {
            return null;
        }

        const { currIndentLevel, prevIndentLevel, match } = this.matchWhitespace(text, offset);

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

    protected override buildTerminalToken(terminal: TerminalRule): TokenType {
        const tokenType = super.buildTerminalToken(terminal);
        const { indentTokenName, dedentTokenName, whitespaceTokenName } = this.options;

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
    popRemainingDedents(text: string): IToken[] {
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

/**
 * A lexer that is aware of indentation in the input text.
 * The only purpose of this lexer is to reset the internal state of the {@link IndentationAwareTokenBuilder}
 * between the tokenization of different text inputs.
 *
 * In your module, you can override the default lexer with this one as such:
 * ```ts
 * parser: {
 *    TokenBuilder: () => new IndentationAwareTokenBuilder(),
 *    Lexer: (services) => new IndentationAwareLexer(services),
 * }
 * ```
 */
export class IndentationAwareLexer extends DefaultLexer {

    protected readonly indentationTokenBuilder: IndentationAwareTokenBuilder;

    constructor(services: LangiumCoreServices) {
        super(services);
        if (services.parser.TokenBuilder instanceof IndentationAwareTokenBuilder) {
            this.indentationTokenBuilder = services.parser.TokenBuilder;
        } else {
            throw new Error('IndentationAwareLexer requires an accompanying IndentationAwareTokenBuilder');
        }
    }

    override tokenize(text: string): LexerResult {
        const result = super.tokenize(text);

        // reset the indent stack between processing of different text inputs
        const remainingDedents = this.indentationTokenBuilder.popRemainingDedents(text);
        result.tokens.push(...remainingDedents);

        // remove any "indent-dedent" pair with an empty body as these are typically
        // added by comments or lines with just whitespace but have no real value
        const { indentTokenType, dedentTokenType } = this.indentationTokenBuilder;
        // Use tokenTypeIdx for fast comparison
        const indentTokenIdx = indentTokenType.tokenTypeIdx;
        const dedentTokenIdx = dedentTokenType.tokenTypeIdx;
        const cleanTokens: IToken[] = [];
        const length = result.tokens.length - 1;
        for (let i = 0; i < length; i++) {
            const token = result.tokens[i];
            const nextToken = result.tokens[i + 1];
            if (token.tokenTypeIdx === indentTokenIdx && nextToken.tokenTypeIdx === dedentTokenIdx) {
                i++;
                continue;
            }

            cleanTokens.push(token);
        }
        // Push last token separately
        cleanTokens.push(result.tokens[length]);
        result.tokens = cleanTokens;

        return result;
    }
}
