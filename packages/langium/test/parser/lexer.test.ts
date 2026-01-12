/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Lexer } from 'langium';
import { describe, expect, test } from 'vitest';
import { createServicesForGrammar } from 'langium/grammar';

describe('DefaultLexer', () => {

    test('should expose lexer definition', async () => {
        const lexer = await getLexer(`
        grammar X
        entry Y: y='Y';
        hidden terminal WS: /\\s+/;
        `);
        expect(Object.values(lexer.definition)).toHaveLength(2);
        expect(lexer.definition.Y.name).toBe('Y');
        expect(lexer.definition.WS.name).toBe('WS');
    });

    test('should lex input', async () => {
        const lexer = await getLexer(`
        grammar X
        entry Y: name='Y';
        hidden terminal WS: /\\s+/;
        `);
        const result = lexer.tokenize('Y');
        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0].image).toBe('Y');
        expect(result.errors).toHaveLength(0);
        expect(result.hidden).toHaveLength(0);
    });

    test('should return lexer errors', async () => {
        const lexer = await getLexer(`
        grammar X
        entry Y: name=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        `);
        const result = lexer.tokenize('4');
        expect(result.tokens).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.hidden).toHaveLength(0);
    });

    test('should lex hidden terminals', async () => {
        const lexer = await getLexer(`
        grammar X
        entry Y: name=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        `);
        const result = lexer.tokenize('Y /* Test */');
        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0].image).toBe('Y');
        expect(result.errors).toHaveLength(0);
        expect(result.hidden).toHaveLength(1);
        expect(result.hidden[0].image).toBe('/* Test */');
    });

    test('should support lookbehind in regexes', async () => {
        // This test ensures that Langium's token builder can handle lookbehind regexes.
        // This previously wasn't supported by Chevrotain, but as of version 11.1.0 it is supported.
        const lexer = await getLexer(`
        grammar Test
        entry Y: "a" name=ID;
        terminal ID: /(?<=a\\s*)(?<!b\\s*)[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        `);
        const result = lexer.tokenize('a myIdentifier');
        expect(result.tokens).toHaveLength(2);
        expect(result.tokens[0].image).toBe('a');
        expect(result.tokens[1].image).toBe('myIdentifier');
        expect(result.errors).toHaveLength(0);
        expect(result.hidden).toHaveLength(0);
    });

});

async function getLexer(grammar: string): Promise<Lexer> {
    const services = await createServicesForGrammar({
        grammar
    });
    return services.parser.Lexer;
}
