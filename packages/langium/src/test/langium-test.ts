/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CompletionItem, CompletionList, Diagnostic, DocumentSymbol, FoldingRange, FormattingOptions, Range, ReferenceParams, SemanticTokensParams, SemanticTokenTypes, TextDocumentIdentifier, TextDocumentPositionParams, WorkspaceSymbol } from 'vscode-languageserver';
import type { LangiumServices, LangiumSharedServices } from '../services';
import type { AstNode, CstNode, Properties } from '../syntax-tree';
import type { LangiumDocument } from '../workspace/documents';
import type { BuildOptions } from '../workspace/document-builder';
import { CancellationTokenSource, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { escapeRegExp } from '../utils/regex-util';
import { findNodeForProperty } from '../utils/grammar-util';
import { SemanticTokensDecoder } from '../lsp/semantic-token-provider';
import { TextDocument } from 'vscode-languageserver-textdocument';
import assert from 'assert';

export interface ParseHelperOptions extends BuildOptions {
    documentUri?: string;
}

export function parseHelper<T extends AstNode = AstNode>(services: LangiumServices): (input: string, options?: ParseHelperOptions) => Promise<LangiumDocument<T>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    return async (input, options) => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const uri = URI.parse(options?.documentUri ?? `file:///${randomNumber}${metaData.fileExtensions[0]}`);
        const document = services.shared.workspace.LangiumDocumentFactory.fromString<T>(input, uri);
        services.shared.workspace.LangiumDocuments.addDocument(document);
        await documentBuilder.build([document], options);
        return document;
    };
}

export type ExpectFunction = (actual: unknown, expected: unknown, message?: string) => void;

let expectedFunction: ExpectFunction = (actual, expected, message) => {
    assert.deepStrictEqual(actual, expected, message);
};

/**
 * Overrides the assertion function used by tests. Uses `assert.deepStrictEqual` by default
 *
 * @deprecated Since 1.2.0. Do not override the assertion functionality.
 */
export function expectFunction(functions: ExpectFunction): void {
    expectedFunction = functions;
}

export interface ExpectedBase {
    text: string
    indexMarker?: string
    rangeStartMarker?: string
    rangeEndMarker?: string
}

export interface ExpectedHighlight extends ExpectedBase {
    index?: number
    rangeIndex?: number | number[]
}

/**
 * Testing utility function for the `textDocument/documentHighlight` LSP request
 *
 * @returns A function that performs the assertion
 */
export function expectHighlight(services: LangiumServices): (input: ExpectedHighlight) => Promise<void> {
    return async input => {
        const { output, indices, ranges } = replaceIndices(input);
        const document = await parseDocument(services, output);
        const highlightProvider = services.lsp.DocumentHighlightProvider;
        const highlights = await highlightProvider?.getDocumentHighlight(document, textDocumentPositionParams(document, indices[input.index ?? 0])) ?? [];
        const rangeIndex = input.rangeIndex;
        if (Array.isArray(rangeIndex)) {
            expectedFunction(highlights.length, rangeIndex.length, `Expected ${rangeIndex.length} highlights but received ${highlights.length}`);
            for (let i = 0; i < rangeIndex.length; i++) {
                const index = rangeIndex[i];
                const expectedRange: Range = {
                    start: document.textDocument.positionAt(ranges[index][0]),
                    end: document.textDocument.positionAt(ranges[index][1])
                };
                const range = highlights[i].range;
                expectedFunction(range, expectedRange, `Expected range ${rangeToString(expectedRange)} does not match actual range ${rangeToString(range)}`);
            }
        } else if (typeof rangeIndex === 'number') {
            const expectedRange: Range = {
                start: document.textDocument.positionAt(ranges[rangeIndex][0]),
                end: document.textDocument.positionAt(ranges[rangeIndex][1])
            };
            expectedFunction(highlights.length, 1, `Expected a single highlight but received ${highlights.length}`);
            const range = highlights[0].range;
            expectedFunction(range, expectedRange, `Expected range ${rangeToString(expectedRange)} does not match actual range ${rangeToString(range)}`);
        } else {
            expectedFunction(highlights.length, ranges.length, `Expected ${ranges.length} highlights but received ${highlights.length}`);
            for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                const expectedRange: Range = {
                    start: document.textDocument.positionAt(range[0]),
                    end: document.textDocument.positionAt(range[1])
                };
                const targetRange = highlights[i].range;
                expectedFunction(targetRange, expectedRange, `Expected range ${rangeToString(expectedRange)} does not match actual range ${rangeToString(targetRange)}`);
            }
        }
    };
}

export interface ExpectedSymbolsList extends ExpectedBase {
    expectedSymbols: Array<string | DocumentSymbol>
    symbolToString?: (item: DocumentSymbol) => string
}
export interface ExpectedSymbolsCallback extends ExpectedBase {
    assert: (symbols: DocumentSymbol[]) => void;
}
export type ExpectedSymbols = ExpectedSymbolsList | ExpectedSymbolsCallback;

export function expectSymbols(services: LangiumServices): (input: ExpectedSymbols) => Promise<void> {
    return async input => {
        const document = await parseDocument(services, input.text);
        const symbolProvider = services.lsp.DocumentSymbolProvider;
        const symbols = await symbolProvider?.getSymbols(document, textDocumentParams(document)) ?? [];

        if ('assert' in input && typeof input.assert === 'function') {
            input.assert(symbols);
        } else if ('expectedSymbols' in input) {
            const symbolToString = input.symbolToString ?? (symbol => symbol.name);
            const expectedSymbols = input.expectedSymbols;

            if (symbols.length === expectedSymbols.length) {
                for (let i = 0; i < expectedSymbols.length; i++) {
                    const expected = expectedSymbols[i];
                    const item = symbols[i];
                    if (typeof expected === 'string') {
                        expectedFunction(symbolToString(item), expected);
                    } else {
                        expectedFunction(item, expected);
                    }
                }
            } else {
                const symbolsMapped = symbols.map((s, i) => expectedSymbols[i] === undefined || typeof expectedSymbols[i] === 'string' ? symbolToString(s) : s);
                expectedFunction(symbolsMapped, expectedSymbols, `Expected ${expectedSymbols.length} but found ${symbols.length} symbols in document`);
            }
        }
    };
}

export interface ExpectedWorkspaceSymbolsBase {
    query?: string
}

export interface ExpectedWorkspaceSymbolsList extends ExpectedWorkspaceSymbolsBase {
    expectedSymbols: Array<string | WorkspaceSymbol>;
    symbolToString?: (item: WorkspaceSymbol) => string;
}

export interface ExpectedWorkspaceSymbolsCallback extends ExpectedWorkspaceSymbolsBase {
    assert: (symbols: WorkspaceSymbol[]) => void;
}

export type ExpectedWorkspaceSymbols = ExpectedWorkspaceSymbolsList | ExpectedWorkspaceSymbolsCallback;

export function expectWorkspaceSymbols(services: LangiumSharedServices): (input: ExpectedWorkspaceSymbols) => Promise<void> {
    return async input => {
        const symbolProvider = services.lsp.WorkspaceSymbolProvider;
        const symbols = await symbolProvider?.getSymbols({
            query: input.query ?? ''
        }) ?? [];

        if ('assert' in input && typeof input.assert === 'function') {
            input.assert(symbols);
        } else if ('expectedSymbols' in input) {
            const symbolToString = input.symbolToString ?? (symbol => symbol.name);
            const expectedSymbols = input.expectedSymbols;

            if (symbols.length === expectedSymbols.length) {
                for (let i = 0; i < expectedSymbols.length; i++) {
                    const expected = expectedSymbols[i];
                    const item = symbols[i];
                    if (typeof expected === 'string') {
                        expectedFunction(symbolToString(item), expected);
                    } else {
                        expectedFunction(item, expected);
                    }
                }

            } else {
                const symbolsMapped = symbols.map((s, i) => expectedSymbols[i] === undefined || typeof expectedSymbols[i] === 'string' ? symbolToString(s) : s);
                expectedFunction(symbolsMapped, expectedSymbols, `Expected ${expectedSymbols.length} but found ${symbols.length} symbols in workspace`);
            }
        }
    };
}

export interface ExpectedFoldings extends ExpectedBase {
    assert?: (foldings: FoldingRange[], expected: Array<[number, number]>) => void;
}

export function expectFoldings(services: LangiumServices): (input: ExpectedFoldings) => Promise<void> {
    return async input => {
        const { output, ranges } = replaceIndices(input);
        const document = await parseDocument(services, output);
        const foldingRangeProvider = services.lsp.FoldingRangeProvider;
        const foldings = await foldingRangeProvider?.getFoldingRanges(document, textDocumentParams(document)) ?? [];
        foldings.sort((a, b) => a.startLine - b.startLine);
        if ('assert' in input && typeof input.assert === 'function') {
            input.assert(foldings, ranges);

        } else {
            expectedFunction(foldings.length, ranges.length, `Expected ${ranges.length} but received ${foldings.length} foldings`);
            for (let i = 0; i < ranges.length; i++) {
                const expected = ranges[i];
                const item = foldings[i];
                const expectedStart = document.textDocument.positionAt(expected[0]);
                const expectedEnd = document.textDocument.positionAt(expected[1]);
                expectedFunction(item.startLine, expectedStart.line, `Expected folding start at line ${expectedStart.line} but received folding start at line ${item.startLine} instead.`);
                expectedFunction(item.endLine, expectedEnd.line, `Expected folding end at line ${expectedEnd.line} but received folding end at line ${item.endLine} instead.`);
            }
        }
    };
}

export function textDocumentParams(document: LangiumDocument): { textDocument: TextDocumentIdentifier } {
    return { textDocument: { uri: document.textDocument.uri } };
}

export interface ExpectedCompletionItems extends ExpectedBase {
    index: number
    expectedItems: Array<string | CompletionItem>
    itemToString?: (item: CompletionItem) => string
}
export interface ExpectedCompletionCallback extends ExpectedBase {
    index: number;
    assert: (completions: CompletionList) => void;
}
export type ExpectedCompletion = ExpectedCompletionItems | ExpectedCompletionCallback;

export function expectCompletion(services: LangiumServices): (expectedCompletion: ExpectedCompletion) => Promise<void> {
    return async expectedCompletion => {
        const { output, indices } = replaceIndices(expectedCompletion);
        const document = await parseDocument(services, output);
        const completionProvider = services.lsp.CompletionProvider;
        const offset = indices[expectedCompletion.index];
        const completions = await completionProvider?.getCompletion(document, textDocumentPositionParams(document, offset)) ?? { isIncomplete: false, items: [] };

        if ('assert' in expectedCompletion && typeof expectedCompletion.assert === 'function') {
            expectedCompletion.assert(completions);

        } else if ('expectedItems' in expectedCompletion) {
            const itemToString = expectedCompletion.itemToString ?? (completion => completion.label);
            const expectedItems = expectedCompletion.expectedItems;
            const items = completions.items.sort((a, b) => a.sortText?.localeCompare(b.sortText || '0') || 0);

            if (items.length === expectedItems.length) {
                for (let i = 0; i < expectedItems.length; i++) {
                    const expected = expectedItems[i];
                    const completion = items[i];
                    if (typeof expected === 'string') {
                        expectedFunction(itemToString(completion), expected);
                    } else {
                        expectedFunction(completion, expected);
                    }
                }

            } else {
                const itemsMapped = items.map((s, i) => expectedItems[i] === undefined || typeof expectedItems[i] === 'string' ? itemToString(s) : s);
                expectedFunction(itemsMapped, expectedItems, `Expected ${expectedItems.length} but received ${items.length} completion items`);
            }
        }
    };
}

export interface ExpectedGoToDefinition extends ExpectedBase {
    index: number,
    rangeIndex: number | number[]
}

export function expectGoToDefinition(services: LangiumServices): (expectedGoToDefinition: ExpectedGoToDefinition) => Promise<void> {
    return async expectedGoToDefinition => {
        const { output, indices, ranges } = replaceIndices(expectedGoToDefinition);
        const document = await parseDocument(services, output);
        const definitionProvider = services.lsp.DefinitionProvider;
        const locationLinks = await definitionProvider?.getDefinition(document, textDocumentPositionParams(document, indices[expectedGoToDefinition.index])) ?? [];
        const rangeIndex = expectedGoToDefinition.rangeIndex;
        if (Array.isArray(rangeIndex)) {
            expectedFunction(locationLinks.length, rangeIndex.length, `Expected ${rangeIndex.length} definitions but received ${locationLinks.length}`);
            for (const index of rangeIndex) {
                const expectedRange: Range = {
                    start: document.textDocument.positionAt(ranges[index][0]),
                    end: document.textDocument.positionAt(ranges[index][1])
                };
                const range = locationLinks[0].targetSelectionRange;
                expectedFunction(range, expectedRange, `Expected range ${rangeToString(expectedRange)} does not match actual range ${rangeToString(range)}`);
            }
        } else {
            const expectedRange: Range = {
                start: document.textDocument.positionAt(ranges[rangeIndex][0]),
                end: document.textDocument.positionAt(ranges[rangeIndex][1])
            };
            expectedFunction(locationLinks.length, 1, `Expected a single definition but received ${locationLinks.length}`);
            const range = locationLinks[0].targetSelectionRange;
            expectedFunction(range, expectedRange, `Expected range ${rangeToString(expectedRange)} does not match actual range ${rangeToString(range)}`);
        }
    };
}

export interface ExpectedFindReferences extends ExpectedBase {
    includeDeclaration: boolean
}

export function expectFindReferences(services: LangiumServices): (expectedFindReferences: ExpectedFindReferences) => Promise<void> {
    return async expectedFindReferences => {
        const { output, indices, ranges } = replaceIndices(expectedFindReferences);
        const document = await parseDocument(services, output);
        const expectedRanges: Range[] = ranges.map(range => ({
            start: document.textDocument.positionAt(range[0]),
            end: document.textDocument.positionAt(range[1])
        }));
        const referenceFinder = services.lsp.ReferencesProvider;
        for (const index of indices) {
            const referenceParameters = referenceParams(document, index, expectedFindReferences.includeDeclaration);
            const references = await referenceFinder?.findReferences(document, referenceParameters) ?? [];

            expectedFunction(references.length, expectedRanges.length, 'Found references do not match amount of expected references');
            for (const reference of references) {
                expectedFunction(expectedRanges.some(range => isRangeEqual(range, reference.range)), true, `Found unexpected reference at range ${rangeToString(reference.range)}`);
            }
        }
        clearDocuments(services);
    };
}

export function referenceParams(document: LangiumDocument, offset: number, includeDeclaration: boolean): ReferenceParams {
    return {
        textDocument: { uri: document.textDocument.uri },
        position: document.textDocument.positionAt(offset),
        context: { includeDeclaration }
    };
}
export interface ExpectedHover extends ExpectedBase {
    index: number
    hover?: string | RegExp
}

export function expectHover(services: LangiumServices): (expectedHover: ExpectedHover) => Promise<void> {
    return async expectedHover => {
        const { output, indices } = replaceIndices(expectedHover);
        const document = await parseDocument(services, output);
        const hoverProvider = services.lsp.HoverProvider;
        const hover = await hoverProvider?.getHoverContent(document, textDocumentPositionParams(document, indices[expectedHover.index]));
        const hoverContent = hover && MarkupContent.is(hover.contents) ? hover.contents.value : undefined;
        if (typeof expectedHover.hover !== 'object') {
            expectedFunction(hoverContent, expectedHover.hover);
        } else {
            const value = hoverContent ?? '';
            expectedFunction(
                expectedHover.hover.test(value),
                true,
                `Hover '${value}' does not match regex /${expectedHover.hover.source}/${expectedHover.hover.flags}.`
            );
        }
    };
}

export interface ExpectFormatting {
    before: string
    after: string
    range?: Range
    options?: FormattingOptions
}

export function expectFormatting(services: LangiumServices): (expectedFormatting: ExpectFormatting) => Promise<void> {
    const formatter = services.lsp.Formatter;
    if (!formatter) {
        throw new Error(`No formatter registered for language ${services.LanguageMetaData.languageId}`);
    }
    return async expectedFormatting => {
        const document = await parseDocument(services, expectedFormatting.before);
        const identifier = { uri: document.uri.toString() };
        const options = expectedFormatting.options ?? {
            insertSpaces: true,
            tabSize: 4
        };
        const edits = await (expectedFormatting.range ?
            formatter.formatDocumentRange(document, { options, textDocument: identifier, range: expectedFormatting.range }) :
            formatter.formatDocument(document, { options, textDocument: identifier }));

        const editedDocument = TextDocument.applyEdits(document.textDocument, edits);
        expectedFunction(editedDocument, expectedFormatting.after);
    };
}

export function textDocumentPositionParams(document: LangiumDocument, offset: number): TextDocumentPositionParams {
    return { textDocument: { uri: document.textDocument.uri }, position: document.textDocument.positionAt(offset) };
}

export async function parseDocument<T extends AstNode = AstNode>(services: LangiumServices, input: string): Promise<LangiumDocument<T>> {
    const document = await parseHelper<T>(services)(input);
    if (!document.parseResult) {
        throw new Error('Could not parse document');
    }
    return document;
}

export function replaceIndices(base: ExpectedBase): { output: string, indices: number[], ranges: Array<[number, number]> } {
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
        const document = await parse(input, { validationChecks: 'all' });
        return { document, diagnostics: document.diagnostics ?? [] };
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
    node?: T;
    property?: Properties<T> | { name: Properties<T>, index?: number };
}

export interface ExpectDiagnosticRangeOptions {
    range: Range;
}

export interface ExpectDiagnosticOffsetOptions {
    offset: number
    length: number
}

export type Predicate<T> = (arg: T) => boolean;

export function isRangeEqual(lhs: Range, rhs: Range): boolean {
    return lhs.start.character === rhs.start.character
        && lhs.start.line === rhs.start.line
        && lhs.end.character === rhs.end.character
        && lhs.end.line === rhs.end.line;
}

export function rangeToString(range: Range): string {
    return `${range.start.line}:${range.start.character}--${range.end.line}:${range.end.character}`;
}

export function filterByOptions<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, options: ExpectDiagnosticOptions<N>) {
    const filters: Array<Predicate<Diagnostic>> = [];
    if ('node' in options && options.node) {
        let cstNode: CstNode | undefined = options.node.$cstNode;
        if (options.property) {
            const name = typeof options.property === 'string' ? options.property : options.property.name;
            const index = typeof options.property === 'string' ? undefined : options.property.index;
            cstNode = findNodeForProperty(cstNode, name, index);
        }
        if (!cstNode) {
            throw new Error('Cannot find the node!');
        }
        filters.push(d => isRangeEqual(cstNode!.range, d.range));
    }
    if ('offset' in options) {
        const outer = {
            start: validationResult.document.textDocument.positionAt(options.offset),
            end: validationResult.document.textDocument.positionAt(options.offset + options.length)
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
    expectedFunction(filtered.length, 0, `Expected no issues, but found ${filtered.length}`);
}

export function expectIssue<T extends AstNode = AstNode, N extends AstNode = AstNode>(validationResult: ValidationResult<T>, filterOptions?: ExpectDiagnosticOptions<N>): void {
    const filtered = filterOptions ? filterByOptions<T, N>(validationResult, filterOptions) : validationResult.diagnostics;
    expectedFunction(filtered.length > 0, true, 'Found no issues');
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

export function clearDocuments(services: LangiumServices): Promise<void> {
    const allDocs = services.shared.workspace.LangiumDocuments.all.map(x => x.uri).toArray();
    return services.shared.workspace.DocumentBuilder.update([], allDocs);
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
        const tokens = await tokenProvider.semanticHighlight(document, params, new CancellationTokenSource().token);
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
    expectedFunction(result.length, 1, `Expected one token with the specified options but found ${result.length}`);
}
