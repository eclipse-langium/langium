/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices, EmptyFileSystem } from '../../src';
import { Assignment, Grammar, ParserRule } from '../../src/grammar/generated/ast';
import { expectError, validationHelper } from '../../src/test';
import { IssueCodes } from '../../src/grammar/langium-grammar-validator';

const services = createLangiumGrammarServices(EmptyFileSystem);
const validate = validationHelper<Grammar>(services.grammar);

describe('Langium grammar validation', () => {

    // TODO: needs to be reimplemented once the type system has been refactored
    // test('Declared interfaces warn when extending inferred interfaces', async () => {
    //     const validationResult = await validate(`
    //     InferredT: prop=ID;

    //     interface DeclaredExtendsInferred extends InferredT {}`);

    //     // should get a warning when basing declared types on inferred types
    //     expectWarning(validationResult, /Extending an interface by a parser rule gives an ambiguous type, instead of the expected declared type./, {
    //         node: validationResult.document.parseResult.value.interfaces[0],
    //         property: {name: 'superTypes'}
    //     });
    // });

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

    // TODO: needs to be reimplemented once the type system has been refactored
    // test('Declared interfaces cannot extend inferred unions directly', async () => {
    //     const validationResult = await validate(`
    //     InferredUnion: InferredI1 | InferredI2;

    //     InferredI1: prop1=ID;
    //     InferredI2: prop2=ID;

    //     interface DeclaredExtendsUnion extends InferredUnion {}
    //     `);

    //     // should get an error on DeclaredExtendsUnion, since it cannot extend an inferred union
    //     expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule InferredUnion./, {
    //         node: validationResult.document.parseResult.value.interfaces[0],
    //         property: {name: 'superTypes'}
    //     });
    // });

    // TODO: needs to be reimplemented once the type system has been refactored
    // test('Declared interfaces cannot extend inferred unions via indirect inheritance', async () => {

    //     const validationResult = await validate(`
    //     InferredUnion: InferredI1 | InferredI2;

    //     InferredI1: prop1=ID;
    //     InferredI2: prop2=ID;

    //     Intermediary: InferredUnion;

    //     interface DeclaredExtendsInferred extends Intermediary {}
    //     `);

    //     // same error, but being sure that this holds when an inferred type extends another inferred type
    //     expectError(validationResult, /An interface cannot extend a union type, which was inferred from parser rule Intermediary./, {
    //         node: validationResult.document.parseResult.value.interfaces[0],
    //         property: {name: 'superTypes'}
    //     });
    // });

    test('Actions cannot redefine declared types', async () => {
        const validationResult = await validate(`
        grammar G
        interface A {
            val: string
        }
        entry X: 'x' {A} val=ID;
        Y: 'y' {infer A} q='broken';
        `);
        expectError(validationResult, /A is a declared type and cannot be redefined./, {
            range: {
                start: {character: 15, line: 6},
                end: {character: 24, line: 6}
            },
            code: IssueCodes.SuperfluousInfer
        });
    });
});