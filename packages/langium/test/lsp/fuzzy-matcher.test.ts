/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { DefaultFuzzyMatcher } from 'langium/lsp';

const matcher = new DefaultFuzzyMatcher();

describe('Fuzzy Matcher', () => {

    test('Matches full string', () => {
        expect(matcher.match('Hello', 'Hello')).toBeTruthy();
    });

    test('Matches first few characters', () => {
        expect(matcher.match('He', 'Hello')).toBeTruthy();
    });

    test('Matches first few characters - negative', () => {
        expect(matcher.match('ell', 'Hello')).toBeFalsy();
    });

    test('Matches omitted characters', () => {
        expect(matcher.match('Ho', 'Hello')).toBeTruthy();
    });

    test('Matches omitted characters - negative', () => {
        expect(matcher.match('Hi', 'Hello')).toBeFalsy();
    });

});
