/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumCoreServices } from 'langium';
import { describe, expect, test, beforeEach } from 'vitest';
import { createServicesForGrammar  } from 'langium/grammar';
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

interface A extends AstNode {
    name: string
}
