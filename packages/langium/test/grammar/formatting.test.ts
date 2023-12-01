/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectFormatting } from 'langium/test';

const services = createLangiumGrammarServices({ ...EmptyFileSystem }).grammar;
const formatting = expectFormatting(services);

describe('Langium grammar formatting tests', () => {

    test('Should format simple grammar correctly', async () => {
        await formatting({
            before: 'grammar T\nA:val=ID;',
            after: 'grammar T\nA:\n    val=ID;'
        });
    });

    test('Should format more complex grammar correctly', async () => {
        await formatting({
            before: `grammar T
A:'a' aval=ID;B:'b' bval=ID;terminal ID: /[a-zA-Z_]\\w*/;`,
            after: `grammar T
A:
    'a' aval=ID;
B:
    'b' bval=ID;
terminal ID: /[a-zA-Z_]\\w*/;`
        });
    });

    // Added to guard against #912 (Grammar formatter deletes code)
    test('Should not format syntactically incorrect grammar', async () => {
        await formatting({
            before: `grammar Code
Param: name=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;`,
            after: `grammar Code
Param: name=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;`
        });
    });

    test('Should allow formatting range before a parser/lexer error', async () => {
        await formatting({
            before: `grammar Code
P1: 'p1' a=ID;
P2: 'p2' b=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;
P3: 'p3' c=ID;`,
            after: `grammar Code
P1:
    'p1' a=ID;
P2: 'p2' b=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;
P3: 'p3' c=ID;`,

            range: {
                start: { line: 0, character: 0},
                end: { line: 1, character: 14}
            }
        });
    });

    test('Disallow formatting range on or after a parser/lexer error', async () => {
        const before = `grammar Code
P1: 'p1' a=ID;
P2: 'p2' b=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;
P3: 'p3' c=ID;`;

        // expect that formatting doesn't occur after the error line
        await formatting({
            before,
            after: `grammar Code
P1: 'p1' a=ID;
P2: 'p2' b=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;
P3: 'p3' c=ID;`,

            range: {
                start: { line: 5, character: 0},
                end: { line: 6, character: 0}
            }
        });

        // expect that formatting doesn't occur on the error line
        await formatting({
            before,
            after: `grammar Code
P1: 'p1' a=ID;
P2: 'p2' b=ID
hidden terminal WS: /\\s+/;
terminal ID: /[_a-zA-Z][\\w_]*/;
P3: 'p3' c=ID;`,

            range: {
                start: { line: 0, character: 0},
                end: { line: 4, character: 0}
            }
        });
    });

});
