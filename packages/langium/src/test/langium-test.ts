/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    CancellationTokenSource,
    CompletionItem, Diagnostic, DiagnosticSeverity, DocumentSymbol, MarkupContent, Range, SemanticTokensParams, SemanticTokenTypes, TextDocumentIdentifier, TextDocumentPositionParams
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { LangiumServices } from '../services';
import { AstNode, Properties } from '../syntax-tree';
import { escapeRegExp } from '../utils/regex-util';
import { LangiumDocument } from '../workspace/documents';
import { findNodeForFeature } from '../grammar/grammar-util';
import { SemanticTokensDecoder } from '../lsp/semantic-token-provider';

export function parseHelper<T extends AstNode = AstNode>(services: LangiumServices): (input: string) => Promise<LangiumDocument<T>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    return async input => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const uri = URI.parse(`file:///${randomNumber}${metaData.fileExtensions[0]}`);
        const document = services.shared.workspace.LangiumDocumentFactory.fromString<T>(input, uri);
        await documentBuilder.build([document]);
        return document;
    };
}

export type ExpectFunction = (actual: unknown, expected: unknown) => void;

export interface ExpectedBase {
    text: string
    indexMarker?: string
    rangeStartMarker?: string
    rangeEndMarker?: string
}

export interface ExpectedSymbols extends ExpectedBase {
    expectedSymbols: DocumentSymbol[]
}

export function expectSymbols(services: LangiumServices, expectEqual: ExpectFunction): (input: ExpectedSymbols) => Promise<void> {
    return async input => {
        const document = await parseDocument(services, input.text);
        const symbolProvider = services.lsp.DocumentSymbolProvider;
        const symbols = await symbolProvider.getSymbols(document, textDocumentParams(document));
        expectEqual(symbols.length, input.expectedSymbols.length);
        for (let i = 0; i < input.expectedSymbols.length; i++) {
            const expected = input.expectedSymbols[i];
            const item = symbols[i];
            if (typeof expected === 'string') {
                expectEqual(item.name, expected);
            } else {
                expectEqual(item, expected);
            }
        }
    };
}

export function expectFoldings(services: LangiumServices, expectEqual: ExpectFunction): (input: ExpectedBase) => Promise<void> {
    return async input => {
        const { output, ranges } = replaceIndices(input);
        const document = await parseDocument(services, output);
        const foldingRangeProvider = services.lsp.FoldingRangeProvider;
        const foldings = await foldingRangeProvider.getFoldingRanges(document, textDocumentParams(document));
        foldings.sort((a, b) => a.startLine - b.startLine);
        expectEqual(foldings.length, ranges.length);
        for (let i = 0; i < ranges.length; i++) {
            const expected = ranges[i];
            const item = foldings[i];
            expectEqual(item.startLine, document.textDocument.positionAt(expected[0]).line);
            expectEqual(item.endLine, document.textDocument.positionAt(expected[1]).line);
        }
    };
}

function textDocumentParams(document: LangiumDocument): { textDocument: TextDocumentIdentifier } {
    return { textDocument: { uri: document.textDocument.uri } };
}

export interface ExpectedCompletion extends ExpectedBase {
    index: number
    expectedItems: Array<string | CompletionItem>
}

export function expectCompletion(services: LangiumServices, expectEqual: ExpectFunction): (completion: ExpectedCompletion) => Promise<void> {
    return async expectedCompletion => {
        const { output, indices } = replaceIndices(expectedCompletion);
        const document = await parseDocument(services, output);
        const completionProvider = services.lsp.completion.CompletionProvider;
        const offset = indices[expectedCompletion.index];
        const completions = await completionProvider.getCompletion(document, textDocumentPositionParams(document, offset));
        const items = completions.items.sort((a, b) => a.sortText?.localeCompare(b.sortText || '0') || 0);
        expectEqual(items.length, expectedCompletion.expectedItems.length);
        for (let i = 0; i < expectedCompletion.expectedItems.length; i++) {
            const expected = expectedCompletion.expectedItems[i];
            const completion = items[i];
            if (typeof expected === 'string') {
                expectEqual(completion.label, expected);
            } else {
                expectEqual(completion, expected);
            }
        }
    };
}

export interface ExpectedGoToDefinition extends ExpectedBase {
    index: number,
    rangeIndex: number
}

export function expectGoToDefinition(services: LangiumServices, expectEqual: ExpectFunction): (expectedGoToDefinition: ExpectedGoToDefinition) => Promise<void> {
    return async expectedGoToDefinition => {
        const { output, indices, ranges } = replaceIndices(expectedGoToDefinition);
        const document = await parseDocument(services, output);
        const goToResolver = services.lsp.GoToResolver;
        const locationLink = await goToResolver.goToDefinition(document, textDocumentPositionParams(document, indices[expectedGoToDefinition.index])) ?? [];
        const expectedRange: Range = {
            start: document.textDocument.positionAt(ranges[expectedGoToDefinition.rangeIndex][0]),
            end: document.textDocument.positionAt(ranges[expectedGoToDefinition.rangeIndex][1])
        };
        expectEqual(locationLink.length, 1);
        expectEqual(locationLink[0].targetSelectionRange, expectedRange);
    };
}

export interface ExpectedHover extends ExpectedBase {
    index: number
    hover?: string
}

export function expectHover(services: LangiumServices, cb: ExpectFunction): (expectedHover: ExpectedHover) => Promise<void> {
    return async expectedHover => {
        const { output, indices } = replaceIndices(expectedHover);
        const document = await parseDocument(services, output);
        const hoverProvider = services.lsp.HoverProvider;
        const hover = await hoverProvider.getHoverContent(document, textDocumentPositionParams(document, indices[expectedHover.index]));
        const hoverContent = hover && MarkupContent.is(hover.contents) ? hover.contents.value : undefined;
        cb(hoverContent, expectedHover.hover);
    };
}

function textDocumentPositionParams(document: LangiumDocument, offset: number): TextDocumentPositionParams {
    return { textDocument: { uri: document.textDocument.uri }, position: document.textDocument.positionAt(offset) };
}

export async function parseDocument<T extends AstNode = AstNode>(services: LangiumServices, input: string): Promise<LangiumDocument<T>> {
    const document = await parseHelper<T>(services)(input);
    if (!document.parseResult) {
        throw new Error('Could not parse document');
    }
    return document;
}

function replaceIndices(base: ExpectedBase): { output: string, indices: number[], ranges: Array<[number, number]> } {
    const indices: number[] = [];
    const ranges: Array<[number, number]> = [];
    const rangeStack: number[] = [];
    const indexMarker = base.indexMarker || '<|>';
    const rangeStartMarker = base.rangeStartMarker || '<|';
    const rangeEndMarker = base.rangeEndMarker || '|>';
    const regex = new RegExp(`${escapeRegExp(indexMarker)}|${escapeRegExp(rangeStartMarker)}|${escapeRegExp(rangeEndMarker)}`);

    let matched = true;
    let input = base.text;

    while (matched) {
        const regexMatch = regex.exec(input);
        if (regexMatch) {
            const matchedString = regexMatch[0];
            switch (matchedString) {
                case indexMarker:
                    indices.push(regexMatch.index);
                    break;
                case rangeStartMarker:
                    rangeStack.push(regexMatch.index);
                    break;
                case rangeEndMarker: {
                    const rangeStart = rangeStack.pop() || 0;
                    ranges.push([rangeStart, regexMatch.index]);
                    break;
                }
            }
            input = input.substring(0, regexMatch.index) + input.substring(regexMatch.index + matchedString.length);
        } else {
            matched = false;
        }
    }

    return { output: input, indices, ranges: ranges.sort((a, b) => a[0] - b[0]) };
}

export interface ValidationResult<T extends AstNode = AstNode> {
    diagnostics: Diagnostic[];
    document: LangiumDocument<T>;
}

export function validationHelper<T extends AstNode = AstNode>(services: LangiumServices): (input: string) => Promise<ValidationResult<T>> {
    const parse = parseHelper<T>(services);
    return async (input) => {
        const document = await parse(input);
        return { document, diagnostics: await services.validation.DocumentValidator.validateDocument(document) };
    };
}

export type ExpectDiagnosticOptionsWithoutContent<T extends AstNode = AstNode> = ExpectDiagnosticCode & (ExpectDiagnosticAstOptions<T> | ExpectDiagnosticRangeOptions | ExpectDiagnosticOffsetOptions);
export type ExpectDiagnosticOptions<T extends AstNode = AstNode> = ExpectDiagnosticContent & ExpectDiagnosticOptionsWithoutContent<T>;

export interface ExpectDiagnosticContent {
    message?: string | RegExp
    severity?: DiagnosticSeverity;
}

export interface ExpectDiagnosticCode {
    code?: string;
}

export interface ExpectDiagnosticAstOptions<T extends AstNode> {
    node: T;
    property?: { name: Properties<T>, index?: number };
}

export interface ExpectDiagnosticRangeOptions {
    range: Range;
}

export interface ExpectDiagnosticOffsetOptions {
    offset: number
    length: number
}

export type Predicate<T> = (arg: T) => boolean;

function isRangeEqual(lhs: Range, rhs: Range): boolean {
    return lhs.start.character === rhs.start.character
        && lhs.start.line === rhs.start.line
        && lhs.end.character === rhs.end.character
        && lhs.end.line === rhs.end.line;
}

function filterByOptions<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, options: ExpectDiagnosticOptions<N>) {
    const filters: Array<Predicate<Diagnostic>> = [];
    if ('node' in options) {
        const cstNode = options.property
            ? findNodeForFeature(options.node.$cstNode, options.property.name, options.property.index)
            : options.node.$cstNode;
        if (!cstNode) {
            throw new Error('Cannot find the node!');
        }
        filters.push(d => isRangeEqual(cstNode.range, d.range));
    }
    if ('offset' in options) {
        const outer = {
            start: validationResult.document.textDocument.positionAt(options.offset),
            end: validationResult.document.textDocument.positionAt(options.offset + options.length - 1)
        };
        filters.push(d => isRangeEqual(outer, d.range));
    }
    if ('range' in options) {
        filters.push(d => isRangeEqual(options.range!, d.range));
    }
    if (options.code) {
        filters.push(d => d.code === options.code);
    }
    if (options.message) {
        if (typeof options.message === 'string') {
            filters.push(d => d.message === options.message);
        } else if (options.message instanceof RegExp) {
            const regexp = options.message as RegExp;
            filters.push(d => regexp.test(d.message));
        }
    }
    if (options.severity) {
        filters.push(d => d.severity === options.severity);
    }
    return validationResult.diagnostics.filter(diag => filters.every(holdsFor => holdsFor(diag)));
}

export function expectNoIssues<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, filterOptions?: ExpectDiagnosticOptions<N>): void {
    const filtered = filterOptions ? filterByOptions<T, N>(validationResult, filterOptions) : validationResult.diagnostics;
    expect(filtered).toHaveLength(0);
}

export function expectIssue<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, filterOptions?: ExpectDiagnosticOptions<N>): void {
    const filtered = filterOptions ? filterByOptions<T, N>(validationResult, filterOptions) : validationResult.diagnostics;
    expect(filtered).not.toHaveLength(0);
}

export function expectError<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, message: string | RegExp, filterOptions: ExpectDiagnosticOptionsWithoutContent<N>): void {
    const content: ExpectDiagnosticContent = {
        message,
        severity: DiagnosticSeverity.Error
    };
    expectIssue<T, N>(validationResult, {
        ...filterOptions,
        ...content,
    });
}
export function expectWarning<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, message: string | RegExp, filterOptions: ExpectDiagnosticOptionsWithoutContent<N>): void {
    const content: ExpectDiagnosticContent = {
        message,
        severity: DiagnosticSeverity.Warning
    };
    expectIssue<T, N>(validationResult, {
        ...filterOptions,
        ...content,
    });
}

export interface DecodedSemanticTokensWithRanges {
    tokens: SemanticTokensDecoder.DecodedSemanticToken[];
    ranges: Array<[number, number]>;
}

export function highlightHelper<T extends AstNode = AstNode>(services: LangiumServices): (input: string) => Promise<DecodedSemanticTokensWithRanges> {
    const parse = parseHelper<T>(services);
    const tokenProvider = services.lsp.SemanticTokenProvider!;
    return async text => {
        const { output: input, ranges } = replaceIndices({
            text
        });
        const document = await parse(input);
        const params: SemanticTokensParams = { textDocument: { uri: document.textDocument.uri } };
        const tokens = tokenProvider.semanticHighlight(document, params, new CancellationTokenSource().token);
        return { tokens: SemanticTokensDecoder.decode(tokens, document), ranges };
    };
}

export interface DecodedTokenOptions {
    rangeIndex?: number;
    tokenType: SemanticTokenTypes;
}

export function expectSemanticToken(tokensWithRanges: DecodedSemanticTokensWithRanges, options: DecodedTokenOptions): void {
    const range = tokensWithRanges.ranges[options.rangeIndex || 0];
    const result = tokensWithRanges.tokens.filter(t => {
        return t.tokenType === options.tokenType && t.offset === range[0] && t.offset + t.text.length === range[1];
    });
    expect(result).toHaveLength(1);
}
