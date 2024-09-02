/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { URI } from 'langium';
import { UriUtils } from '../../src/index.js';

describe('URI Utils', () => {
    test('relative path in same directory', () => {
        const from = URI.file('/a/b');
        const to = URI.file('/a/b/d.txt');
        expect(UriUtils.relative(from, to)).toBe('d.txt');
    });

    test('relative path in parent directory', () => {
        const from = URI.file('/a/b');
        const to = URI.file('a/d.txt');
        expect(UriUtils.relative(from, to)).toBe('../d.txt');
    });

    test('relative path in sub directory', () => {
        const from = URI.file('/a');
        const to = URI.file('/a/b/c.txt');
        expect(UriUtils.relative(from, to)).toBe('b/c.txt');
    });

    test('relative path in other directory', () => {
        const from = URI.file('/a/b');
        const to = URI.file('/a/c/d.txt');
        expect(UriUtils.relative(from, to)).toBe('../c/d.txt');
    });

    test('Equal uris are equal', () => {
        const uri1 = 'file:///a/b';
        const uri2 = 'file:///a/b';
        expect(UriUtils.equals(uri1, uri2)).toBeTruthy();
        expect(UriUtils.equals(URI.parse(uri1), URI.parse(uri2))).toBeTruthy();
        expect(UriUtils.equals(uri1, URI.parse(uri2))).toBeTruthy();
        expect(UriUtils.equals(URI.parse(uri1), uri2)).toBeTruthy();
    });

    test('Non-equal uris are not equal', () => {
        const uri1 = 'file:///a/b';
        const uri2 = 'file:///c/b';
        expect(UriUtils.equals(uri1, uri2)).toBeFalsy();
        expect(UriUtils.equals(URI.parse(uri1), URI.parse(uri2))).toBeFalsy();
        expect(UriUtils.equals(uri1, URI.parse(uri2))).toBeFalsy();
        expect(UriUtils.equals(URI.parse(uri1), uri2)).toBeFalsy();
        expect(UriUtils.equals(uri1, undefined)).toBeFalsy();
    });
});

describe('URIUtils#normalize', () => {

    test('Should normalize document URIs', () => {
        const vscodeWindowsUri = 'file:///c%3A/path/to/file.txt';
        const upperCaseDriveUri = 'file:///C:/path/to/file.txt';
        const lowerCaseDriveUri = 'file:///c:/path/to/file.txt';

        const normalized = vscodeWindowsUri;
        expect(UriUtils.normalize(vscodeWindowsUri)).toBe(normalized);
        expect(UriUtils.normalize(upperCaseDriveUri)).toBe(normalized);
        expect(UriUtils.normalize(lowerCaseDriveUri)).toBe(normalized);
    });

    test('Should work as usual with POSIX URIs', () => {
        const uri = 'file:///path/to/file.txt';
        expect(UriUtils.normalize(uri)).toBe(uri);
    });

});
