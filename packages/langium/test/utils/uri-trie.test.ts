/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test, beforeEach } from 'vitest';
import { UriTrie } from 'langium';

describe('UriTrie', () => {
    let trie: UriTrie<string>;

    beforeEach(() => {
        trie = new UriTrie();
    });

    test('inserts and finds documents', () => {
        const uri = 'file:///test.txt';
        expect(trie.find(uri)).toBeUndefined();
        trie.insert(uri, uri);
        expect(trie.find(uri)).toBe(uri);
    });

    test('inserts and has documents', () => {
        const uri = 'file:///test.txt';
        expect(trie.has(uri)).toBeFalsy();
        trie.insert(uri, uri);
        expect(trie.has(uri)).toBeTruthy();
    });

    test('returns false for has on parents', () => {
        const uri = 'file:///parent/test.txt';
        trie.insert(uri, uri);
        expect(trie.has(uri)).toBeTruthy();
        expect(trie.has('file:///parent')).toBeFalsy();
    });

    test('deletes documents', () => {
        const uri = 'file:///test.txt';
        trie.insert(uri, uri);
        expect(trie.find(uri)).toBe(uri);
        trie.delete(uri);
        expect(trie.find(uri)).toBeUndefined();
    });

    test('deletes directories', () => {
        const document0 = 'file:///test.txt';
        const document1 = 'file:///parent/test1.txt';
        const document2 = 'file:///parent/test2.txt';
        trie.insert(document0, document0);
        trie.insert(document1, document1);
        trie.insert(document2, document2);
        expect(trie.find(document1)).toBe(document1);
        expect(trie.find(document2)).toBe(document2);
        trie.delete('file:///parent');
        expect(trie.find(document0)).toBe(document0);
        expect(trie.find(document1)).toBeUndefined();
        expect(trie.find(document2)).toBeUndefined();
    });

    test('deletes directories with trailing slash', () => {
        const document1 = 'file:///parent/test1.txt';
        const document2 = 'file:///parent/test2.txt';
        trie.insert(document1, document1);
        trie.insert(document2, document2);
        expect(trie.find(document1)).toBe(document1);
        expect(trie.find(document2)).toBe(document2);
        trie.delete('file:///parent/');
        expect(trie.find(document1)).toBeUndefined();
        expect(trie.find(document2)).toBeUndefined();
    });

    test('finds all documents', () => {
        const document1 = 'file:///test.txt';
        const document2 = 'file:///parent/test.txt';
        trie.insert(document1, document1);
        trie.insert(document2, document2);
        expect(trie.all()).toEqual([document1, document2]);
    });

    test('finds documents by prefix', () => {
        const document0 = 'file:///test.txt';
        const document1 = 'file:///parent/test1.txt';
        const document2 = 'file:///parent/test2.txt';
        trie.insert(document0, document0);
        trie.insert(document1, document1);
        trie.insert(document2, document2);
        expect(trie.findAll('file:///')).toEqual([document0, document1, document2]);
        expect(trie.findAll('file:///parent')).toEqual([document1, document2]);
        // Ensure that the trailing slash does not affect the result
        expect(trie.findAll('file:///parent/')).toEqual([document1, document2]);
    });

    test('returns undefined for non-existing documents', () => {
        expect(trie.find('file:///test.txt')).toBeUndefined();
    });

    test('returns empty array for non-existing prefixes', () => {
        expect(trie.findAll('file:///test')).toEqual([]);
    });
});