/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { Assignment, Grammar, ParserRule } from '../../src/grammar/generated/ast';
import { expectError, expectWarning, validationHelper } from '../../src/test';

const services = createLangiumGrammarServices();
const validate = validationHelper<Grammar>(services.grammar);

describe('Langium grammar validation', () => {
    test('Parser rule should not assign fragments', async () => {
        // arrange
        const grammarText = `
        grammar Test
        entry A: b=B;
        fragment B: name=ID;
        terminal ID returns string: /[a-z]+/;
        `;

        // act
        const validationResult = await validate(grammarText);

        // assert
        expectError(validationResult, /Cannot use fragment rule 'B' for assignment of property 'b'./, {
            node: (validationResult.document.parseResult.value.rules[0] as ParserRule).definition as Assignment,
            property: {name: 'terminal'}
        });
    });

    // verifies that interfaces can't extend type unions, especially inferred ones
    test('Interfaces extend only interfaces', async () => {
        const validationResult = await validate(`
        grammar G

        entry SA: S1 | S2;
        SB: S1;

        S1: 's1' s1=ID;
        S2: 's2' s2=ID;

        interface DA extends SA {}
        interface D2 extends S2 {}
        interface DB extends SB {}

        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `);
        expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule SA./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: {name: 'superTypes'}
        });
        expectWarning(validationResult, /Extending an interface by a parser rule gives an ambiguous type, instead of the expected declared type./, {
            node: validationResult.document.parseResult.value.interfaces[1],
            property: {name: 'superTypes'}
        });
        expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule SB./, {
            node: validationResult.document.parseResult.value.interfaces[2],
            property: {name: 'superTypes'}
        });
    });
});