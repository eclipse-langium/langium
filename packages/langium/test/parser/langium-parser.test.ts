/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, type AstNode, type LangiumCoreServices } from 'langium';
import { describe, expect, test, beforeEach } from 'vitest';
import { createLangiumGrammarServices, createServicesForGrammar  } from 'langium/grammar';
import { parseHelper  } from 'langium/test';

describe('Partial parsing', () => {
    const content = `
    grammar Test
    entry Model: 'model' (a+=A | b+=B)*;
    A: 'a' name=ID;
    B: 'b' name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    hidden terminal WS: /\\s+/;
    `;

    let services: LangiumCoreServices;

    beforeEach(async () => {
        services = await createServicesForGrammar({ grammar: content });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function expectCorrectParse(text: string, rule?: string): any {
        const result = services.parser.LangiumParser.parse(text, { rule });
        expect(result.parserErrors.length).toBe(0);
        return result.value;
    }

    function expectErrorneousParse(text: string, rule?: string): void {
        const result = services.parser.LangiumParser.parse(text, { rule });
        expect(result.parserErrors.length).toBeGreaterThan(0);
    }

    test('Should parse correctly with normal entry rule', () => {
        const result = expectCorrectParse('model a Foo b Bar');
        expect(result.a[0].name).toEqual('Foo');
        expect(result.b[0].name).toEqual('Bar');
    });

    test('Should parse correctly with alternative entry rule A', () => {
        const result = expectCorrectParse('a Foo', 'A');
        expect(result.name).toEqual('Foo');
        expectErrorneousParse('model a Foo', 'A');
        expectErrorneousParse('b Bar', 'A');
    });

    test('Should parse correctly with alternative entry rule B', () => {
        const result = expectCorrectParse('b Foo', 'B');
        expect(result.name).toEqual('Foo');
        expectErrorneousParse('model b Foo', 'B');
        expectErrorneousParse('a Foo', 'B');
    });

    test('Parse helper supports using alternative entry rule A', async () => {
        const parse = parseHelper<A>(services);
        const document = await parse('a Foo', { parserOptions: { rule: 'A' } });
        expect(document.parseResult.parserErrors.length).toBe(0);
        expect(document.parseResult.value.name).toEqual('Foo');
    });

});

describe('hidden node parsing', () => {

    test('finishes in expected time', async () => {
        const parser = createLangiumGrammarServices(EmptyFileSystem).grammar.parser.LangiumParser;
        let content = 'Rule:';
        // Adding hidden nodes used to cause exponential parsing time behavior
        for (let i = 0; i < 2500; i++) {
            content += "'a' /* A */ /* B */ /* C */\n";
        }
        content += ';';
        const start = Date.now();
        // This roughly takes 100-300 ms on a modern machine
        // If it takes longer, the hidden node parsing is likely to be exponential
        // On an older version of the parser, this took ~5 seconds
        const result = parser.parse(content);
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
        const end = Date.now();
        expect(end - start).toBeLessThan(1000);
    });

});

interface A extends AstNode {
    name: string
}
