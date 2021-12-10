/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    CompletionItem, DocumentSymbol, MarkupContent, Range, TextDocumentIdentifier, TextDocumentPositionParams
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LangiumDocument } from '../documents/document';
import { BuildResult } from '../documents/document-builder';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { escapeRegExp } from '../utils/regex-util';

export function parseHelper<T extends AstNode = AstNode>(services: LangiumServices): (input: string) => Promise<BuildResult<T>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    return async input => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const textDocument = TextDocument.create(`file:///${randomNumber}${metaData.fileExtensions[0]}`, metaData.languageId, 0, input);
        // For now we have to add the newly created document to the list of documents manually
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (services.shared.workspace.TextDocuments as any)._documents[textDocument.uri] = textDocument;
        const document = services.shared.workspace.LangiumDocumentFactory.fromTextDocument<T>(textDocument);
        const buildResult = await documentBuilder.build(document);
        return buildResult as BuildResult<T>;
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
    const buildResult = await parseHelper<T>(services)(input);
    const document = getDocument<T>(buildResult.document.parseResult.value);
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

    return {output: input, indices, ranges: ranges.sort((a, b) => a[0] - b[0]) };
}
