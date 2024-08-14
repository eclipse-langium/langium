/******************************************************************************
* Copyright 2023 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { expandToString } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectFormatting, parseDocument } from 'langium/test';
import { describe, expect, test } from 'vitest';

const services = createLangiumGrammarServices(EmptyFileSystem);
const formatting = expectFormatting(services.grammar);

describe('Grammar Formatter', () => {

    test('Indents interface properties', async () => {
        await formatting({
            before: expandToString`
                interface Test {
                // This is a comment
                a: string
                        b: number
                            // This is another comment
                            c: boolean
                }
            `,
            after: expandToString`
                interface Test {
                    // This is a comment
                    a: string
                    b: number
                    // This is another comment
                    c: boolean
                }
            `
        });
    });

    test('Formats interface extends references', async () => {
        await formatting({
            before: expandToString`
                interface A // This is a comment
                extends   B,C,    D,E{}
            `,
            after: expandToString`
                interface A // This is a comment
                extends B, C, D, E {
                }
            `
        });
    });

    test('Formats union type definitions', async () => {
        await formatting({
            before: expandToString`
                type A=    B | C | D
                ;
            `,
            after: expandToString`
                type A = B | C | D;
            `
        });
    });

    test('No edits if document is already formatted', async () => {

        const formatter = services.grammar.lsp.Formatter;
        if (!formatter) {
            throw new Error(`No formatter registered for language ${services.grammar.LanguageMetaData.languageId}`);
        }
        const document = await parseDocument(services.grammar, expandToString`
            interface Test {
                // This is a comment
                a: string
                b: number
                // This is another comment
                c: boolean
            }
            `);
        const identifier = { uri: document.uri.toString() };
        const options = {
            insertSpaces: true,
            tabSize: 4
        };
        const edits = await formatter.formatDocument(document, { options, textDocument: identifier });
        expect(edits.length).toBe(0);
    });

    test('Formats parser rule definitions with alternatives', async () => {
        await formatting({
            before: expandToString`
                Type:
                DataType | Entity;
            `,
            after: expandToString`
                Type:
                    DataType | Entity;
            `
        });
    });
});
