/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumParser } from 'langium';
import { describe, expect, test, beforeEach } from 'vitest';
import { createServicesForGrammar } from 'langium/grammar';

describe('Partial parsing', () => {
    const content = `
    grammar Test
    entry Model: (a+=A | b+=B)*;
    A: 'a' name=ID;
    B: 'b' name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeEach(async () => {
        parser = await parserFromGrammar(content);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function expectCorrectParse(text: string, rule?: string): any {
        const result = parser.parse(text, { rule });
        expect(result.parserErrors.length).toBe(0);
        return result.value;
    }

    function expectErrorneousParse(text: string, rule?: string): void {
        const result = parser.parse(text, { rule });
        expect(result.parserErrors.length).toBeGreaterThan(0);
    }

    test('Should parse correctly with normal entry rule', () => {
        const result = expectCorrectParse('a Foo b Bar');
        expect(result.a[0].name).toEqual('Foo');
        expect(result.b[0].name).toEqual('Bar');
    });

    test('Should parse correctly with alternative entry rule A', () => {
        const result = expectCorrectParse('a Foo', 'A');
        expect(result.name).toEqual('Foo');
        expectErrorneousParse('b Bar', 'A');
    });

    test('Should parse correctly with alternative entry rule B', () => {
        const result = expectCorrectParse('b Foo', 'B');
        expect(result.name).toEqual('Foo');
        expectErrorneousParse('a Foo', 'B');
    });
});

async function parserFromGrammar(grammar: string): Promise<LangiumParser> {
    return (await createServicesForGrammar({ grammar })).parser.LangiumParser;
}
