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
import { RangeComparison, compareRange } from '../../src/utils/cst-utils.js';

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

describe('compareRange', () => {
    test.each([
        // Different lines
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }, { start: { line: 99, character: 1 }, end: { line: 99, character: 10 } }],
        // Same line, second range is far behind first
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }, { start: { line: 1, character: 9999 }, end: { line: 1, character: 10000 } }],
        // Same line, second range is next to first
        /* Range start is zero-based in LSP, for example:
         *   _|A A A A A B B B B
         *   0 1 2 3 4 5 6 7 8 9
         *   ○----A----|
         *             ○---B---|
         * Range A: 0-5, Range B: 5-9
        */
        [{ start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }, { start: { line: 1, character: 5 }, end: { line: 1, character: 9 } }],
    ])('Before', (range, to) => {
        const result = compareRange(range, to);
        expect(result).toEqual(RangeComparison.Before);
    });

    test.each([
        // Different lines
        [{ start: { line: 99, character: 1 }, end: { line: 99, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }],
        // Same line, second range is far before first
        [{ start: { line: 1, character: 9999 }, end: { line: 1, character: 10000 } }, { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }],
        // Same line, second range is in front of first
        [{ start: { line: 1, character: 5 }, end: { line: 1, character: 9 } }, { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }],
    ])('After', (range, to) => {
        const result = compareRange(range, to);
        expect(result).toEqual(RangeComparison.After);
    });

    test.each([
        // Same end position, different start lines
        [{ start: { line: 9, character: 1 }, end: { line: 9, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 9, character: 10 } }],
        // Same end position, same start line but different start characters
        [{ start: { line: 1, character: 9 }, end: { line: 9, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 9, character: 10 } }],
        // Same start position, different end lines
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 10, character: 10 } }],
        // Same start position, same end line but different end characters
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 1, character: 11 } }],
        // Same start and end position
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }],
    ])('Inside', (range, to) => {
        const result = compareRange(range, to);
        expect(result).toEqual(RangeComparison.Inside);
    });

    test.each([
        // Multiple lines
        [{ start: { line: 1, character: 1 }, end: { line: 3, character: 10 } }, { start: { line: 2, character: 1 }, end: { line: 4, character: 10 } }],
        // Same line
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }, { start: { line: 1, character: 5 }, end: { line: 1, character: 15 } }],
    ])('OverlapFront', (range, to) => {
        const result = compareRange(range, to);
        expect(result).toEqual(RangeComparison.OverlapFront);
    });

    test.each([
        // Multiple lines
        [{ start: { line: 2, character: 1 }, end: { line: 4, character: 10 } }, { start: { line: 1, character: 1 }, end: { line: 3, character: 10 } }],
        // Same line
        [{ start: { line: 1, character: 5 }, end: { line: 1, character: 15 } }, { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }],
    ])('OverlapBack', (range, to) => {
        const result = compareRange(range, to);
        expect(result).toEqual(RangeComparison.OverlapBack);
    });

    test.each([
        // Multiple lines
        [{ start: { line: 1, character: 1 }, end: { line: 4, character: 10 } }, { start: { line: 2, character: 1 }, end: { line: 3, character: 10 } }],
        // Same line
        [{ start: { line: 1, character: 1 }, end: { line: 1, character: 99 } }, { start: { line: 1, character: 5 }, end: { line: 1, character: 10 } }],
    ])('Outside', (range, to) => {
        const result = compareRange(range, to);
        expect(result).toEqual(RangeComparison.Outside);
    });
});
