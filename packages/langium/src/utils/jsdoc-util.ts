/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Position, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { LeafCstNode } from '../syntax-tree';
import { escapeRegExp } from './regex-util';

export interface JSDocComment extends JSDocValue {
    readonly elements: JSDocElement[]
}

export type JSDocElement = JSDocParagraph | JSDocTag;

export type JSDocInline = JSDocTag | JSDocLine;

export interface JSDocValue {
    readonly range: Range
    toString(): string
    toMarkdown(options?: JSDocRenderOptions): string
}

export interface JSDocParagraph extends JSDocValue {
    readonly inlines: JSDocInline[]
}

export interface JSDocLine extends JSDocValue {
    readonly text: string
}

export interface JSDocTag extends JSDocValue {
    readonly name: string
    readonly content: JSDocParagraph
    readonly inline: boolean
}

export interface JSDocParseOptions {
    readonly start?: RegExp | string
    readonly end?: RegExp | string
    readonly line?: RegExp | string
}

/**
 * {@link JSDocRenderOptions}
 */
export interface JSDocRenderOptions {
    link?: 'code' | 'plain'
    renderLink?(link: string, display: string): string | undefined
}

export function parseJSDoc(node: LeafCstNode, options?: JSDocParseOptions): JSDocComment;
export function parseJSDoc(content: string, start?: Position, options?: JSDocParseOptions): JSDocComment;
export function parseJSDoc(node: LeafCstNode | string, start?: Position | JSDocParseOptions, options?: JSDocParseOptions): JSDocComment {
    let opts: JSDocParseOptions | undefined;
    let position: Position | undefined;
    if (typeof node === 'string') {
        position = start as Position | undefined;
        opts = options as JSDocParseOptions | undefined;
    } else {
        position = node.range.start;
        opts = start as JSDocParseOptions | undefined;
    }
    if (!position) {
        position = Position.create(0, 0);
    }

    const lines = getLines(node);
    const normalizedOptions = normalizeOptions(opts);

    const tokens = tokenize({
        lines,
        position,
        options: normalizedOptions
    });

    return parseJSDocComment({
        index: 0,
        tokens,
        position
    });
}

export function isJSDoc(node: LeafCstNode | string, options?: JSDocParseOptions): boolean {
    const normalizedOptions = normalizeOptions(options);
    const lines = getLines(node);
    if (lines.length === 0) {
        return false;
    }

    const first = lines[0];
    const last = lines[lines.length - 1];
    const firstRegex = normalizedOptions.start;
    const lastRegex = normalizedOptions.end;

    return Boolean(firstRegex?.exec(first)) && Boolean(lastRegex?.exec(last));
}

function getLines(node: LeafCstNode | string): string[] {
    let content = '';
    if (typeof node === 'string') {
        content = node;
    } else {
        content = node.text;
    }
    const normalized = content.replace(/\r/g, '');
    const lines = normalized.split('\n');
    return lines;
}

// TOKENIZATION

interface JSDocToken {
    type: 'text' | 'tag' | 'break'
    content: string
    range: Range
}

const tagRegex = /@([\p{L}][\p{L}\p{N}]*)?/uy;
const inlineTagRegex = /\{(@[\p{L}][\p{L}\p{N}]*)(\s*)([^\r\n}]+)?\}/gu;

function tokenize(context: TokenizationContext): JSDocToken[] {
    const tokens: JSDocToken[] = [];
    let currentLine = context.position.line;
    let currentCharacter = context.position.character;
    for (let i = 0; i < context.lines.length; i++) {
        const first = i === 0;
        const last = i === context.lines.length - 1;
        let line = context.lines[i];
        let index = 0;

        if (first && context.options.start) {
            const match = context.options.start?.exec(line);
            if (match) {
                index = match.index + match[0].length;
            }
        } else {
            const match = context.options.line?.exec(line);
            if (match) {
                index = match.index + match[0].length;
            }
        }
        if (last) {
            const match = context.options.end?.exec(line);
            if (match) {
                line = line.substring(0, match.index);
            }
        }

        index = skipWhitespace(line, index);

        if (index >= line.length) {
            // Only create a break token when we already have previous tokens
            if (tokens.length > 0) {
                const position = Position.create(currentLine, currentCharacter);
                tokens.push({
                    type: 'break',
                    content: '',
                    range: Range.create(position, position)
                });
            }
        } else {
            tagRegex.lastIndex = index;
            const tagMatch = tagRegex.exec(line);
            if (tagMatch) {
                const value = tagMatch[0];
                const start = Position.create(currentLine, currentCharacter + index);
                const end = Position.create(currentLine, currentCharacter + index + value.length);
                tokens.push({
                    type: 'tag',
                    content: value,
                    range: Range.create(start, end)
                });
                index += value.length;
                index = skipWhitespace(line, index);
            }

            if (index < line.length) {
                const rest = line.substring(index);
                const inlineTagMatches = Array.from(rest.matchAll(inlineTagRegex));
                tokens.push(...buildInlineTokens(inlineTagMatches, rest, currentLine, currentCharacter + index));
            }
        }

        currentLine++;
        currentCharacter = 0;
    }

    // Remove last break token if there is one
    if (tokens.length > 0 && tokens[tokens.length - 1].type === 'break') {
        return tokens.slice(0, -1);
    }

    return tokens;
}

function buildInlineTokens(tags: RegExpMatchArray[], line: string, lineIndex: number, characterIndex: number): JSDocToken[] {
    const tokens: JSDocToken[] = [];

    if (tags.length === 0) {
        const start = Position.create(lineIndex, characterIndex);
        const end = Position.create(lineIndex, characterIndex + line.length);
        tokens.push({
            type: 'text',
            content: line,
            range: Range.create(start, end)
        });
    } else {
        let lastIndex = 0;
        for (const match of tags) {
            const matchIndex = match.index!;
            const startContent = line.substring(lastIndex, matchIndex);
            if (startContent.length > 0) {
                tokens.push({
                    type: 'text',
                    content: line.substring(lastIndex, matchIndex),
                    range: Range.create(
                        Position.create(lineIndex, lastIndex + characterIndex),
                        Position.create(lineIndex, matchIndex + characterIndex)
                    )
                });
            }
            let offset = startContent.length + 1;
            const tagName = match[1];
            tokens.push({
                type: 'tag',
                content: tagName,
                range: Range.create(
                    Position.create(lineIndex, lastIndex + offset + characterIndex),
                    Position.create(lineIndex, lastIndex + offset + tagName.length + characterIndex)
                )
            });
            offset += tagName.length;
            if (match.length === 4) {
                offset += match[2].length;
                const value = match[3];
                tokens.push({
                    type: 'text',
                    content: value,
                    range: Range.create(
                        Position.create(lineIndex, lastIndex + offset + characterIndex),
                        Position.create(lineIndex, lastIndex + offset + value.length + characterIndex)
                    )
                });
            } else {
                tokens.push({
                    type: 'text',
                    content: '',
                    range: Range.create(
                        Position.create(lineIndex, lastIndex + offset + characterIndex),
                        Position.create(lineIndex, lastIndex + offset + characterIndex)
                    )
                });
            }
            lastIndex = matchIndex + match[0].length;
        }
        const endContent = line.substring(lastIndex);
        if (endContent.length > 0) {
            tokens.push({
                type: 'text',
                content: endContent,
                range: Range.create(
                    Position.create(lineIndex, lastIndex + characterIndex),
                    Position.create(lineIndex, line.length + characterIndex)
                )
            });
        }
    }

    return tokens;
}

const whitespaceRegex = /\S/;

function skipWhitespace(line: string, index: number): number {
    const match = line.substring(index).match(whitespaceRegex);
    if (match) {
        return index + match.index!;
    } else {
        return line.length;
    }
}

// PARSING

function parseJSDocComment(context: ParseContext): JSDocComment {
    const startPosition: Position = Position.create(context.position.line, context.position.character);
    if (context.tokens.length === 0) {
        return new JSDocCommentImpl([], Range.create(context.position, context.position));
    }
    const elements: JSDocElement[] = [];
    while (context.index < context.tokens.length) {
        const element = parseJSDocElement(context, elements[elements.length - 1]);
        if (element) {
            elements.push(element);
        }
    }
    return new JSDocCommentImpl(elements, Range.create(startPosition, context.position));
}

function parseJSDocElement(context: ParseContext, last?: JSDocElement): JSDocElement | undefined {
    const next = context.tokens[context.index];
    if (next.type === 'tag') {
        return parseJSDocTag(context, false);
    } else if (next.type === 'text') {
        return parseJSDocText(context);
    } else {
        appendEmptyLine(next, last);
        context.index++;
        return undefined;
    }
}

function appendEmptyLine(token: JSDocToken, element?: JSDocElement): void {
    if (element) {
        const line = new JSDocLineImpl('', token.range);
        if ('inlines' in element) {
            element.inlines.push(line);
        } else {
            element.content.inlines.push(line);
        }
    }
}

function parseJSDocText(context: ParseContext): JSDocParagraph {
    let token = context.tokens[context.index];
    const firstToken = token;
    let lastToken = token;
    const lines: JSDocInline[] = [];
    while (token && token.type !== 'break') {
        lines.push(parseJSDocInline(context));
        lastToken = token;
        token = context.tokens[context.index];
    }
    return new JSDocTextImpl(lines, Range.create(firstToken.range.start, lastToken.range.end));
}

function parseJSDocInline(context: ParseContext): JSDocInline {
    const token = context.tokens[context.index];
    if (token.type === 'tag') {
        return parseJSDocTag(context, true);
    } else {
        return parseJSDocLine(context);
    }
}

function parseJSDocTag(context: ParseContext, inline: boolean): JSDocTag {
    const tagToken = context.tokens[context.index++];
    const name = tagToken.content.substring(1);
    const nextToken = context.tokens[context.index];
    if (nextToken?.type === 'text') {
        if (inline) {
            const docLine = parseJSDocLine(context);
            return new JSDocTagImpl(
                name,
                new JSDocTextImpl([docLine], docLine.range),
                inline,
                Range.create(tagToken.range.start, docLine.range.end)
            );
        } else {
            const textDoc = parseJSDocText(context);
            return new JSDocTagImpl(
                name,
                textDoc,
                inline,
                Range.create(tagToken.range.start, textDoc.range.end)
            );
        }
    } else {
        const range = tagToken.range;
        return new JSDocTagImpl(name, new JSDocTextImpl([], range), inline, range);
    }
}

function parseJSDocLine(context: ParseContext): JSDocLine {
    const token = context.tokens[context.index++];
    return new JSDocLineImpl(token.content, token.range);
}

interface NormalizedOptions {
    start?: RegExp
    end?: RegExp
    line?: RegExp
}

interface TokenizationContext {
    position: Position
    lines: string[]
    options: NormalizedOptions
}

interface ParseContext {
    position: Position
    tokens: JSDocToken[]
    index: number
}

function normalizeOptions(options?: JSDocParseOptions): NormalizedOptions {
    if (!options) {
        return normalizeOptions({
            start: '/**',
            end: '*/',
            line: '*'
        });
    }
    const { start, end, line } = options;
    return {
        start: normalizeOption(start, true),
        end: normalizeOption(end, false),
        line: normalizeOption(line, true)
    };
}

function normalizeOption(option: RegExp | string | undefined, start: boolean): RegExp | undefined {
    if (typeof option === 'string') {
        const escaped = escapeRegExp(option);
        if (start) {
            return new RegExp(`^\\s*${escaped}`);
        } else {
            return new RegExp(`${escaped}\\s*$`);
        }
    } else {
        return option;
    }
}

class JSDocCommentImpl implements JSDocComment {

    readonly elements: JSDocElement[];
    readonly range: Range;

    constructor(elements: JSDocElement[], range: Range) {
        this.elements = elements;
        this.range = range;
    }

    toString(): string {
        let value = '';
        for (const element of this.elements) {
            if (value.length === 0) {
                value = element.toString();
            } else {
                const newLines = 'inlines' in element ? '\n\n' : '\n';
                value += newLines + element.toString();
            }
        }
        return value;
    }

    toMarkdown(options?: JSDocRenderOptions): string {
        let value = '';
        for (const element of this.elements) {
            if (value.length === 0) {
                value = element.toMarkdown(options);
            } else {
                const newLines = '\n\n';
                value += newLines + element.toMarkdown(options);
            }
        }
        return value;
    }
}

class JSDocTagImpl implements JSDocTag {
    name: string;
    content: JSDocParagraph;
    range: Range;
    inline: boolean;

    constructor(name: string, content: JSDocParagraph, inline: boolean, range: Range) {
        this.name = name;
        this.content = content;
        this.inline = inline;
        this.range = range;
    }

    toString(): string {
        let text = `@${this.name}`;
        const content = this.content.toString();
        if (this.content.inlines.length === 1) {
            text = `${text} ${content}`;
        } else if (this.content.inlines.length > 1) {
            text = `${text}\n${content}`;
        }
        if (this.inline) {
            // Inline tags are surrounded by curly braces
            return `{${text}}`;
        } else {
            return text;
        }
    }

    toMarkdown(options?: JSDocRenderOptions): string {
        const content = this.content.toMarkdown(options);
        if (this.inline) {
            const rendered = renderInlineTag(this.name, content, options ?? {});
            if (typeof rendered === 'string') {
                return rendered;
            }
        }
        let text = `*@${this.name}*`;
        if (this.content.inlines.length === 1) {
            text = `${text} — ${content}`;
        } else if (this.content.inlines.length > 1) {
            text = `${text}\n${content}`;
        }
        if (this.inline) {
            // Inline tags are surrounded by curly braces
            return `{${text}}`;
        } else {
            return text;
        }
    }
}

function renderInlineTag(tag: string, content: string, options: JSDocRenderOptions): string | undefined {
    if (tag === 'linkplain' || tag === 'linkcode' || tag === 'link') {
        const index = content.indexOf(' ');
        let display = content;
        if (index > 0) {
            const displayStart = skipWhitespace(content, index);
            display = content.substring(displayStart);
            content = content.substring(0, index);
        }
        if (tag === 'linkcode' || (tag === 'link' && options.link === 'code')) {
            // Surround the display value in a markdown inline code block
            display = `\`${display}\``;
        }
        const renderedLink = options.renderLink?.(content, display) ?? renderLinkDefault(content, display);
        return renderedLink;
    }
    return undefined;
}

function renderLinkDefault(content: string, display: string): string {
    try {
        URI.parse(content, true);
        return `[${display}](${content})`;
    } catch {
        return content;
    }
}

class JSDocTextImpl implements JSDocParagraph {
    inlines: JSDocInline[];
    range: Range;

    constructor(lines: JSDocInline[], range: Range) {
        this.inlines = lines;
        this.range = range;
    }

    toString(): string {
        let text = '';
        for (let i = 0; i < this.inlines.length; i++) {
            const inline = this.inlines[i];
            const next = this.inlines[i + 1];
            text += inline.toString();
            if (next && next.range.start.line > inline.range.start.line) {
                text += '\n';
            }
        }
        return text;
    }

    toMarkdown(options?: JSDocRenderOptions): string {
        let text = '';
        for (let i = 0; i < this.inlines.length; i++) {
            const inline = this.inlines[i];
            const next = this.inlines[i + 1];
            text += inline.toMarkdown(options);
            if (next && next.range.start.line > inline.range.start.line) {
                text += '\n';
            }
        }
        return text;
    }
}

class JSDocLineImpl implements JSDocLine {
    text: string;
    range: Range;

    constructor(text: string, range: Range) {
        this.text = text;
        this.range = range;
    }

    toString(): string {
        return this.text;
    }
    toMarkdown(): string {
        return this.text;
    }

}