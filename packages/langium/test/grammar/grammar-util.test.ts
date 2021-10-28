/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getEntryRule, replaceTokens } from '../../src';
import { grammar } from '../../src/grammar/generated/grammar';

describe('Token replacement', () => {

    test('should keep normal keywords', () => {
        expect(replaceTokens('public')).toBe('Public');
    });

    test('should replace whitespace', () => {
        expect(replaceTokens('with value')).toBe('WithWhitespacevalue');
        expect(replaceTokens('with    value')).toBe('WithWhitespacevalue');
        expect(replaceTokens('with\tvalue')).toBe('WithWhitespacevalue');
    });

    test('should replace special characters', () => {
        expect(replaceTokens('/')).toBe('Slash');
        expect(replaceTokens('\\')).toBe('Backslash');
        expect(replaceTokens('#')).toBe('Hash');
        expect(replaceTokens('!')).toBe('ExclamationMark');
    });

    test('should replace other unicode characters', () => {
        expect(replaceTokens('❤')).toBe('u10084');
        expect(replaceTokens('Ö')).toBe('u214');
    });

});

test('Langium grammar entry rule', () => {
    expect(getEntryRule(grammar())?.name).toBe('Grammar');
});
