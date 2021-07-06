/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { partialMatches } from '../../src';

describe('partial regex', () => {

    test('should match /ab/ string with "a"', () => {
        expect(partialMatches('^ab', 'a')).toBeTruthy();
    });

    test('should match /ab/ with "a"', () => {
        expect(partialMatches(/^ab/, 'a')).toBeTruthy();
    });

    test('should match /[ab]c/ with "a"', () => {
        expect(partialMatches(/^[ab]c/, 'a')).toBeTruthy();
    });

    test('should match /[ab]c/ with "b"', () => {
        expect(partialMatches(/^[ab]c/, 'b')).toBeTruthy();
    });

    test('should match /[ab]c/ with "ac"', () => {
        expect(partialMatches(/^[ab]c/, 'ac')).toBeTruthy();
    });

    test('shouldn\'t match /[^ab]c/ with "a"', () => {
        expect(partialMatches(/^[^ab]c/, 'a')).toBeFalsy();
    });

    test('should match /ab+/ with "a"', () => {
        expect(partialMatches(/^ab+/, 'a')).toBeTruthy();
    });

    test('should match /a*b+/ with "a"', () => {
        expect(partialMatches(/^ab+/, 'a')).toBeTruthy();
    });

    test('should match /a{4}/ with "a"', () => {
        expect(partialMatches(/^a{4}b/, 'a')).toBeTruthy();
    });

    test('should match /a{4}/ with "aaa"', () => {
        expect(partialMatches(/^a{4}b/, 'aaa')).toBeTruthy();
    });

    test('should match /ab/ with "ab"', () => {
        expect(partialMatches(/^ab/, 'ab')).toBeTruthy();
    });

    test('should match /(a|b)c/ with "a"', () => {
        expect(partialMatches(/^(a|b)c/, 'a')).toBeTruthy();
    });

    test('should match /(a|b)?c/ with "c"', () => {
        expect(partialMatches(/^(a|b)?c/, 'c')).toBeTruthy();
    });

    test('shouldn\'t match /(a|b)c/ with "c"', () => {
        expect(partialMatches(/^(a|b)c/, 'c')).toBeFalsy();
    });

    test('shouldn\'t match /ab/ with "b"', () => {
        expect(partialMatches(/^ab/, 'b')).toBeFalsy();
    });

});