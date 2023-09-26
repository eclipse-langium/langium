/******************************************************************************
* Copyright 2023 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem, createLangiumGrammarServices, expandToString } from 'langium';
import { expectFormatting } from 'langium/test';

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
                interface A extends   B,C,    D,E{}
            `,
            after: expandToString`
                interface A extends B, C, D, E {
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

});
