/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getEntryRule, replaceTokens } from '../../src';
import { grammar } from '../../src/grammar/generated/grammar';
import { createLangiumGrammarServices, extractCyclicDef, Grammar } from '../../src';
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

function extractCyclicPath(grammar: Grammar): string[] {
    return extractCyclicDef(grammar.rules).map(cyclicRule => cyclicRule.path.join(' > '));
}

describe('Left recursion detection', () => {

    test('should detect direct left recursion (the production has only yourself', async () => {
        const text = `
            grammar test
            X: X;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>(
            ['X > X > X']);
    });

    test('should detect direct left recursion with a terminal', async () => {
        const text = `
            grammar test
            X: X 'a';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>(
            ['X > X']);
    });

    test('should detect indirect left recursion', async () => {
        const text = `
            grammar test
            X0: X1 'x0';
            X1: X2 'x1';
            X2: X0 'x2';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([
            'X0 > X1 > X2 > X0',
            'X1 > X2 > X0 > X1',
            'X2 > X0 > X1 > X2'
        ]);
    });

    test('should detect direct left recursion with first optional terminal', async () => {
        const text = `
            grammar test
            X: 'a'? X 'a';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([
            'X > X'
        ]);
    });

    test('should detect indirect left recursion with first optional terminal', async () => {
        const text = `
            grammar test
            X0: 'a'? X1 'x0';
            X1: 'b'? X2 'x1';
            X2: 'c'? X0 'x2';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([
            'X0 > X1 > X2 > X0',
            'X1 > X2 > X0 > X1',
            'X2 > X0 > X1 > X2'
        ]);
    });

    test('should detect direct left recursion with first optional self-call', async () => {
        const text = `
            grammar test
            X: X? 'a';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([
            'X > X'
        ]);
    });

    test('should detect indirect left recursion with first optional self-call', async () => {
        const text = `
            grammar test
            X1: 'b'? X2 'x1';
            X0: 'a'? X1 'x0';
            X2: X0? 'x2';
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([

        ]);
    });

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
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([
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
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([
            'R > T > R',
            'T > R > T',
            'RR > TT > RR',
            'TT > RR > TT'
        ]);
    });

    test('shouldn\'t detect left recursion', async () => {
        const text = `
            grammar test
            Expression: '(' Expression ')' | INT;
            InfiniteExpression: '(' InfiniteExpression ')';
            terminal INT returns number: /[0-9]+/;
        `;
        const grammar = (await parseHelper<Grammar>(services)(text)).document.parseResult.value;
        expect(extractCyclicPath(grammar)).toStrictEqual<string[]>([]);
    });
});
