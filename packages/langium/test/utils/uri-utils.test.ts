/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import vscodeUri from 'vscode-uri';
import { relativeURI, equalURI } from 'langium';

describe('URI Utils', () => {
    test('relative path in same directory', () => {
        const from = vscodeUri.URI.file('/a/b');
        const to = vscodeUri.URI.file('/a/b/d.txt');
        expect(relativeURI(from, to)).toBe('d.txt');
    });

    test('relative path in parent directory', () => {
        const from = vscodeUri.URI.file('/a/b');
        const to = vscodeUri.URI.file('a/d.txt');
        expect(relativeURI(from, to)).toBe('../d.txt');
    });

    test('relative path in sub directory', () => {
        const from = vscodeUri.URI.file('/a');
        const to = vscodeUri.URI.file('/a/b/c.txt');
        expect(relativeURI(from, to)).toBe('b/c.txt');
    });

    test('relative path in other directory', () => {
        const from = vscodeUri.URI.file('/a/b');
        const to = vscodeUri.URI.file('/a/c/d.txt');
        expect(relativeURI(from, to)).toBe('../c/d.txt');
    });

    test('Equal uris are equal', () => {
        const uri1 = 'file:///a/b';
        const uri2 = 'file:///a/b';
        expect(equalURI(uri1, uri2)).toBeTruthy();
        expect(equalURI(vscodeUri.URI.parse(uri1), vscodeUri.URI.parse(uri2))).toBeTruthy();
        expect(equalURI(uri1, vscodeUri.URI.parse(uri2))).toBeTruthy();
        expect(equalURI(vscodeUri.URI.parse(uri1), uri2)).toBeTruthy();
    });

    test('Non-equal uris are not equal', () => {
        const uri1 = 'file:///a/b';
        const uri2 = 'file:///c/b';
        expect(equalURI(uri1, uri2)).toBeFalsy();
        expect(equalURI(vscodeUri.URI.parse(uri1), vscodeUri.URI.parse(uri2))).toBeFalsy();
        expect(equalURI(uri1, vscodeUri.URI.parse(uri2))).toBeFalsy();
        expect(equalURI(vscodeUri.URI.parse(uri1), uri2)).toBeFalsy();
        expect(equalURI(uri1, undefined)).toBeFalsy();
    });
});
