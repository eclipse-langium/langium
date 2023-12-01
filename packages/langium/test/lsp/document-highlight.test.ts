/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectHighlight, parseHelper } from 'langium/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const helper = parseHelper(grammarServices);
const highlights = expectHighlight(grammarServices);

describe('DocumentHighlightProvider', () => {

    test('Highlights own declaration', async () => {
        await highlights({
            text: `
                <|Declar<|>ation|>: '';
            `
        });
    });

    test('Highlights own declaration and reference', async () => {
        await highlights({
            text: `
                <|Declaration|>: <|Declar<|>ation|>;
            `
        });
    });

    test('Highlights reference in other file', async () => {
        await helper('Declaration: "";', { documentUri: 'file:///declaration.langium' });
        await highlights({
            text: `
                import "./declaration";
                Reference: <|Declara<|>tion|>;
            `
        });
    });

});
