/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { beforeAll, describe, test, expect } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem } from 'langium';
import { expectFormatting, expectFunction } from 'langium/test';

const services = createLangiumGrammarServices({ ...EmptyFileSystem }).grammar;
const formatting = expectFormatting(services);

describe('Langium grammar formatting tests', () => {

    beforeAll(() => {
        // override expect function to use the one from Vitest
        expectFunction((a,e) => {
            expect(a).toBe(e);
        });
    });

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
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;`,
            after: `grammar Code
Param: name=ID
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;`
        });
    });

});
