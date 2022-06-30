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

        // generates an inferred union of 2 other inferred interfaces
        entry InferredUnion: InferredI1 | InferredI2;

        // for the case where an inferred interface extends another inferred interface
        InferredI0: InferredI1;

        // just for the sake of generating a pair of inferred interfaces
        InferredI1: 'InferredI1' InferredI1=ID;
        InferredI2: 'InferredI2' InferredI2=ID;

        // should fail...
        interface DeclaredExtendsUnion extends InferredUnion {}

        // we can extend an inferred type that has no parent
        interface DeclaredExtendsInferred1 extends InferredI2 {}

        // we can extend an inferred type that extends other inferred types
        interface DeclaredExtendsInferred2 extends InferredI0 {}

        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `);

        // should get an error on DeclaredExtendsUnion, since it cannot extend an inferred union
        expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule InferredUnion./, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: {name: 'superTypes'}
        });

        // should get a warning when basing declared types on inferred types
        expectWarning(validationResult, /Extending an interface by a parser rule gives an ambiguous type, instead of the expected declared type./, {
            node: validationResult.document.parseResult.value.interfaces[1],
            property: {name: 'superTypes'}
        });

        // same warning, but being sure that this holds when an inferred type extends another inferred type
        expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule InferredI0./, {
            node: validationResult.document.parseResult.value.interfaces[2],
            property: {name: 'superTypes'}
        });
    });
});