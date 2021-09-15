/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompletionItem, DocumentSymbol, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LangiumDocument } from '../documents/document';
import { BuildResult } from '../documents/document-builder';
import { LangiumServices } from '../services';
import { getDocument } from '../utils/ast-util';

export function parseHelper(services: LangiumServices): (input: string) => BuildResult {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.documents.DocumentBuilder;
    return input => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const textDocument = TextDocument.create(`file:/${randomNumber}${metaData.fileExtensions[0]}`, metaData.languageId, 0, input);
        const document: LangiumDocument = services.documents.LangiumDocumentFactory.fromTextDocument(textDocument);
        const buildResult = documentBuilder.build(document);
        return buildResult;
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

export function expectSymbols(services: LangiumServices, expectEqual: ExpectFunction): (input: ExpectedSymbols) => void {
    return (input) => {
        const document = parseDocument(services, input.text);
        const symbolProvider = services.lsp.DocumentSymbolProvider;
        const symbols = symbolProvider.getSymbols(document);
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

export function expectFoldings(services: LangiumServices, expectEqual: ExpectFunction): (input: ExpectedBase) => void {
    return (input) => {
        const { output, ranges } = replaceIndices(input);
        const document = parseDocument(services, output);
        const foldingRangeProvider = services.lsp.FoldingRangeProvider;
        const foldings = foldingRangeProvider.getFoldingRanges(document).sort((a, b) => a.startLine - b.startLine);
        expectEqual(foldings.length, ranges.length);
        for (let i = 0; i < ranges.length; i++) {
            const expected = ranges[i];
            const item = foldings[i];
            expectEqual(item.startLine, document.textDocument.positionAt(expected[0]).line);
            expectEqual(item.endLine, document.textDocument.positionAt(expected[1]).line);
        }
    };
}

export interface ExpectedCompletion extends ExpectedBase {
    index: number
    expectedItems: Array<string | CompletionItem>
}

export function expectCompletion(services: LangiumServices, expectEqual: ExpectFunction): (completion: ExpectedCompletion) => void {
    return (expectedCompletion) => {
        const { output, indices } = replaceIndices(expectedCompletion);
        const document = parseDocument(services, output);
        const completionProvider = services.lsp.completion.CompletionProvider;
        const completions = completionProvider.getCompletion(document.parseResult!.value, indices[expectedCompletion.index]);
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

export function expectGoToDefinition(services: LangiumServices, expectEqual: ExpectFunction): (expectedGoToDefinition: ExpectedGoToDefinition) => void {
    return (expectedGoToDefinition) => {
        const { output, indices, ranges } = replaceIndices(expectedGoToDefinition);
        const document = parseDocument(services, output);
        const goToResolver = services.lsp.GoToResolver;
        const position = document.textDocument.positionAt(indices[expectedGoToDefinition.index]);
        const textPos = {
            textDocument: {
                uri: document.textDocument.uri
            },
            position: position
        };
        const locationLink = goToResolver.goToDefinition(document, textPos);
        const expectedRange: Range = {
            start: document.textDocument.positionAt(ranges[expectedGoToDefinition.rangeIndex][0]),
            end: document.textDocument.positionAt(ranges[expectedGoToDefinition.rangeIndex][1])
        };
        expectEqual(locationLink.length, 1);
        expectEqual(locationLink[0].targetSelectionRange, expectedRange);
    };
}

function parseDocument(services: LangiumServices, input: string): LangiumDocument {
    const buildResult = parseHelper(services)(input);
    const document = getDocument(buildResult.parseResult.value);
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
    const regex =  new RegExp(`${escapeRegExp(indexMarker)}|${escapeRegExp(rangeStartMarker)}|${escapeRegExp(rangeEndMarker)}`);

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

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}