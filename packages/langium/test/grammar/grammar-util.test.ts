/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getEntryRule, replaceTokens } from '../../src';
import { grammar } from '../../src/grammar/generated/grammar';
import { createLangiumGrammarServices, extractLeftRecursion, Grammar } from '../../src';
import { parseHelper } from '../../src/test';

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

const services = createLangiumGrammarServices();

function extractLeftRecursionPath(grammar: Grammar): string[] {
    return extractLeftRecursion(grammar.rules).map(cyclicRule => cyclicRule.path.join(' > '));
}

describe('Direct left recursion detection', () => {

    test('should detect with the only one rule call', async () => {
        const text = `
            grammar test
            X: X;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'X > X > X'
        ]);
    });

    test('should detect with a terminal on the right', async () => {
        const text = `
            grammar test
            X: X 'a';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'X > X' // should be 'X > X > X'
        ]);
    });

    test('should detect with the only one rule call and first optional terminal', async () => {
        const text = `
            grammar test
            X: 'a'? X;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'X > X' // should be 'X > X > X'
        ]);
    });

    test('should detect with a terminal on the right and first optional terminal', async () => {
        const text = `
            grammar test
            X: 'a'? X 'a';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'X > X' // should be 'X > X > X'
        ]);
    });

    test('should detect with the only one rule call and first optional self-call', async () => {
        const text = `
            grammar test
            X: X? X;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            // should be
            // 'X > X > X',
            // 'X > X > X'
        ]);
    });

    test('should detect with a terminal on the right and first optional self-call', async () => {
        const text = `
            grammar test
            X: X? X 'a';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            // should be
            // 'X > X > X',
            // 'X > X > X'
        ]);
    });
});

describe('Indirect left recursion detection', () => {

    test('should detect with the only one rule call', async () => {
        const text = `
            grammar test
            R: T;
            T: R;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            // should be
            // 'R > T > R',
            // 'T > R > T'
        ]);
    });

    test('should detect with a terminal on the right', async () => {
        const text = `
            grammar test
            R: T 'r';
            T: X 't';
            X: R 'x';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'R > T > X > R',
            'T > X > R > T',
            'X > R > T > X'
        ]);
    });

    test('should detect with first optional terminal', async () => {
        const text = `
            grammar test
            R: 'r'? T 'r';
            T: 't'? X 't';
            X: 'x'? R 'x';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'R > T > X > R',
            'T > X > R > T',
            'X > R > T > X'
        ]);
    });

    test('should detect with first optional self-call', async () => {
        const text = `
            grammar test
            R: 'r'? T 'r';
            T: 't'? X 't';
            X: R? R 'x';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'T > X > T',
            'X > T > X'
            // should be
            // 'R > T > X > R',
            // 'T > X > R > T',
            // 'X > R > T > X'
        ]);
    });
});

describe('Detection of left recursion in real life examples ', () => {

    test('should return only cycle path (no entry rules)', async () => {
        const text = `
            grammar test
            X: (y+=Y*);
            Y: QualifiedName | R;
            R: 'a'? T 'a' | 'b';
            T: '('? R ')';
            QualifiedName returns string: ID ('.' ID)*;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'R > T > R',
            'T > R > T'
        ]);
    });

    test('should detect all cycles', async () => {
        const text = `
            grammar test
            X: (y+=Y*);
            Y: QualifiedName | R;
            R: 'a'? T 'a' | 'b';
            T: '('? R ')';
            RR: 'a'? TT 'a' | 'b';
            TT: '('? RR ')';
            QualifiedName returns string: ID ('.' ID)*;
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([
            'R > T > R',
            'T > R > T',
            'RR > TT > RR',
            'TT > RR > TT'
        ]);
    });

    test('shouldn\'t detect any recursion as left recursion ', async () => {
        const text = `
            grammar test
            Expression: '(' Expression ')' | INT;
            InfiniteExpression: '(' InfiniteExpression ')';
            terminal INT returns number: /[0-9]+/;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractLeftRecursionPath(grammar)).toStrictEqual<string[]>([]);
    });
});