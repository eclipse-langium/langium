/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompletionItem, DocumentSymbol, Range } from 'vscode-languageserver';
import { LangiumDocument, LangiumDocumentConfiguration } from '../documents/document';
import { BuildResult } from '../documents/document-builder';
import { LangiumServices } from '../services';
import { getDocument } from '../utils/ast-util';

export function parseHelper(services: LangiumServices): (input: string) => BuildResult {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.documents.DocumentBuilder;
    return input => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const document = LangiumDocumentConfiguration.create(`file:/${randomNumber}${metaData.fileExtensions[0]}`, metaData.languageId, 0, input);
        const buildResult = documentBuilder.build(document);
        return buildResult;
    };
}

export type ExpectFunction = (actual: unknown, expected: unknown) => void;

interface ExpectedBase {
    text: string
    indexMarker?: string
    rangeStartMarker?: string
    rangeEndMarker?: string
}

export interface ExpectedSymbols extends ExpectedBase {
    expectedSymbols: DocumentSymbol[]
}

export function expectSymbols(services: LangiumServices, cb: ExpectFunction): (input: ExpectedSymbols) => void {
    return (input) => {
        const document = parseDocument(services, input.text);
        if (!document.parseResult) {
            throw new Error('Could not parse document');
        }
        const symbolProvider = services.lsp.DocumentSymbolProvider;
        const symbols = symbolProvider.getSymbols(document);
        cb(symbols.length, input.expectedSymbols.length);
        for (let i = 0; i < input.expectedSymbols.length; i++) {
            const expected = input.expectedSymbols[i];
            const item = symbols[i];
            if (typeof expected === 'string') {
                cb(item.name, expected);
            } else {
                cb(item, expected);
            }
        }
    };
}

export interface ExpectedCompletion extends ExpectedBase {
    index: number
    expectedItems: Array<string | CompletionItem>
}

export function expectCompletion(services: LangiumServices, cb: ExpectFunction): (completion: ExpectedCompletion) => void {
    return (expectedCompletion) => {
        const { output, indices } = replaceIndices(expectedCompletion);
        const document = parseDocument(services, output);
        if (!document.parseResult) {
            throw new Error('Could not parse document');
        }
        const completionProvider = services.lsp.completion.CompletionProvider;
        const completions = completionProvider.getCompletion(document.parseResult.value, indices[expectedCompletion.index]);
        const items = completions.items.sort((a, b) => a.sortText?.localeCompare(b.sortText || '0') || 0);
        cb(items.length, expectedCompletion.expectedItems.length);
        for (let i = 0; i < expectedCompletion.expectedItems.length; i++) {
            const expected = expectedCompletion.expectedItems[i];
            const completion = items[i];
            if (typeof expected === 'string') {
                cb(completion.label, expected);
            } else {
                cb(completion, expected);
            }
        }
    };
}

export interface ExpectedGoToDefinition extends ExpectedBase {
    index: number,
    rangeIndex: number
}

export function expectGoToDefinition(services: LangiumServices, cb: ExpectFunction): (expectedGoToDefinition: ExpectedGoToDefinition) => void {
    return (expectedGoToDefinition) => {
        const { output, indices, ranges } = replaceIndices(expectedGoToDefinition);
        const document = parseDocument(services, output);
        const goToResolver = services.lsp.GoToResolver;
        const position = document.positionAt(indices[expectedGoToDefinition.index]);
        const textPos = {
            textDocument: {
                uri: document.uri
            },
            position: position
        };
        const locationLink = goToResolver.goToDefinition(document, textPos);
        const expectedRange: Range = {
            start: document.positionAt(ranges[expectedGoToDefinition.rangeIndex][0]),
            end: document.positionAt(ranges[expectedGoToDefinition.rangeIndex][1])
        };
        cb(locationLink.length, 1);
        cb(locationLink[0].targetSelectionRange, expectedRange);
    };
}

function parseDocument(services: LangiumServices, input: string): LangiumDocument {
    const buildResult = parseHelper(services)(input);
    return getDocument(buildResult.parseResult.value);
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