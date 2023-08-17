/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, findLeafNodeAtOffset, EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parser = parseHelper<Grammar>(services.grammar);

describe('CST Utils', () => {

    test('Find Leaf Node at Offset: Main: value=<|>AB;', async () => {
        const text = `
        grammar test
        Main: value=AB;
        terminal fragment Frag: 'B';
        terminal AB: 'A' Frag;
        `;

        const grammar = await parser(text);
        const offset = grammar.textDocument.getText().indexOf('AB');
        const leafnode = findLeafNodeAtOffset(grammar.parseResult.value.$cstNode!, offset!);
        expect(leafnode!.text).toBe('AB');
    });

    test('Find Leaf Node at Offset: Main: value=A<|>B;', async () => {
        const text = `
        grammar test
        Main: value=AB;
        terminal fragment Frag: 'B';
        terminal AB: 'A' Frag;
        `;

        const grammar = await parser(text);
        const offset = grammar.textDocument.getText().indexOf('AB') + 1;
        const leafnode = findLeafNodeAtOffset(grammar.parseResult.value.$cstNode!, offset!);
        expect(leafnode!.text).toBe('AB');
    });

    test('Find Leaf Node at Offset: Main: value=AB<|>;', async () => {
        const text = `
        grammar test
        Main: value=AB;
        terminal fragment Frag: 'B';
        terminal AB: 'A' Frag;
        `;

        const grammar = await parser(text);
        const offset = grammar.textDocument.getText().indexOf('AB') + 2;
        const leafnode = findLeafNodeAtOffset(grammar.parseResult.value.$cstNode!, offset!);
        expect(leafnode!.text).toBe(';');
    });
});
