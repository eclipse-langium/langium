/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createServicesForGrammar, LangiumCompletionParser } from '../../src';

describe('Completion parser', () => {
    test('', async () => {
        const parser = completionParserFromGrammar(`
            grammar g
            hidden terminal WS: /\\s+/;

            entry Entry: A | B | C;

            A: a='1' b='2' 'a';
            B: a='1' b='2' 'b';
            C: a='1' b='2' 'c';
        `);
        const result = parser.parse('1 2 c');
        expect(result).toBeDefined();
        const halfResult = parser.parse('1      2');
        expect(halfResult).toBeDefined();
    });
});

function completionParserFromGrammar(grammar: string): LangiumCompletionParser {
    return createServicesForGrammar({ grammar }).parser.CompletionParser;
}