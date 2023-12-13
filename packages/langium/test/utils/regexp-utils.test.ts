/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { RegExpUtils } from 'langium';

const { getTerminalParts, isMultilineComment, partialMatches } = RegExpUtils;

describe('Partial regexp', () => {

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

describe('Multiline comment detection', () => {

    test('single character string should be not multiline comment', () => {
        expect(isMultilineComment('x')).toBeFalsy();
    });

    test('single character regex should be not multiline comment', () => {
        expect(isMultilineComment(/x/)).toBeFalsy();
    });

    test('single newline character should be multiline comment', () => {
        expect(isMultilineComment(/\n/)).toBeTruthy();
    });

    test('JS style singleline comment should not be multiline comment', () => {
        expect(isMultilineComment(/\/\/[^\n\r]*/)).toBeFalsy();
    });

    test('JS style multiline comment should be multiline comment', () => {
        expect(isMultilineComment(/\/\*[\s\S]*?\*\//)).toBeTruthy();
    });

});

describe('Comment start/end parts', () => {

    test('JS style singleline comment should start with //', () => {
        expect(getTerminalParts(/\/\/[^\n\r]*/)).toEqual([{
            start: '//',
            end: ''
        }]);
    });

    test('JS style multiline comment should start with /* and end with */', () => {
        expect(getTerminalParts(/\/\*[\s\S]*?\*\//)).toEqual([{
            start: '/\\*',
            end: '\\*/'
        }]);
    });

    test('JS style combined comment should contain both /* */ and // parts', () => {
        expect(getTerminalParts(/\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/)).toEqual([{
            start: '/\\*',
            end: '\\*/'
        }, {
            start: '//',
            end: ''
        }]);
    });

    test('Shell style single line comment starts with #', () => {
        expect(getTerminalParts(/#[^\n\r]*/)).toEqual([{
            start: '#',
            end: ''
        }]);
    });
});
