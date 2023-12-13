/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, LeafCstNode } from 'langium';
import { CstUtils, EmptyFileSystem } from 'langium';
import { expandToString } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';

const { findLeafNodeAtOffset, findLeafNodeBeforeOffset } = CstUtils;

const services = createLangiumGrammarServices(EmptyFileSystem);
const parser = parseHelper<Grammar>(services.grammar);

describe('findLeafNode', () => {

    for (const findLeafNode of [
        findLeafNodeAtOffset,
        findLeafNodeBeforeOffset
    ]) {
        test(`Find "AB" using ${findLeafNode.name} at Main: value=<|>AB;`, async () => {
            const leafnode = await getLeafNode(findLeafNode, 0);
            expect(leafnode?.text).toBe('AB');
        });

        test(`Find "AB" using ${findLeafNode.name} at Main: value=A<|>B;`, async () => {
            const leafnode = await getLeafNode(findLeafNode, 1);
            expect(leafnode?.text).toBe('AB');
        });

        test(`Find ";" using ${findLeafNode.name} at Main: value=AB<|>;`, async () => {
            const leafnode = await getLeafNode(findLeafNode, 2);
            expect(leafnode?.text).toBe(';');
        });
    }

    test('Find no leaf Node at offset: Main: value=AB <|> ;', async () => {
        const leafnode = await getLeafNode(findLeafNodeAtOffset, 2, 3);
        expect(leafnode).toBeUndefined();
    });

    test('Find "AB" before offset: Main: value=AB <|> ;', async () => {
        const leafnode = await getLeafNode(findLeafNodeBeforeOffset, 2, 3);
        expect(leafnode).toBeDefined();
        expect(leafnode?.text).toBe('AB');
    });

    async function getLeafNode(findLeafNode: typeof findLeafNodeAtOffset, index: number, spaces?: number): Promise<LeafCstNode | undefined> {
        const text = expandToString`
        Main: value=AB${spaces ? ' '.repeat(spaces) : ''};
        terminal AB: 'A';
        `;
        const grammar = await parser(text);
        const offset = text.indexOf('AB') + index;
        const leafnode = findLeafNode(grammar.parseResult.value.$cstNode!, offset!);
        return leafnode;
    }
});
