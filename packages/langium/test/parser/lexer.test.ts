/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createServicesForGrammar, Lexer } from '../../src';

describe('DefaultLexer', () => {

    test('should expose lexer definition', () => {
        const lexer = getLexer(`
        grammar X
        entry Y: y='Y';
        hidden terminal WS: /\\s+/;
        `);
        expect(Object.values(lexer.definition)).toHaveLength(2);
        expect(lexer.definition.Y.name).toBe('Y');
        expect(lexer.definition.WS.name).toBe('WS');
    });

    test('should lex input', () => {
        const lexer = getLexer(`
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

    test('should return lexer errors', () => {
        const lexer = getLexer(`
        grammar X
        entry Y: name=ID;
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        `);
        const result = lexer.tokenize('4');
        expect(result.tokens).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.hidden).toHaveLength(0);
    });

    test('should lex hidden terminals', () => {
        const lexer = getLexer(`
        grammar X
        entry Y: name=ID;
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
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

});

function getLexer(grammar: string): Lexer {
    const services = createServicesForGrammar({
        grammar
    });
    return services.parser.Lexer;
}
