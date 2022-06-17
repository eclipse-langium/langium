/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { Assignment, Grammar, ParserRule } from '../../src/grammar/generated/ast';
import { IssueCodes } from '../../src/grammar/langium-grammar-validator';
import { expectError, expectNoIssues, validationHelper } from '../../src/test';

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
            node: (validationResult.document.parseResult.value.rules[0] as ParserRule).alternatives as Assignment,
            property: {name: 'terminal'}
        });
    });

    test('Duplicated interfaces should be flagged for being non-unique', async () => {
        const validationResult = await validate(`
        grammar T
        interface Dupe {}
        interface Dupe {}
        `);
        // Both interfaces should have the same error
        const re = /A type's name has to be unique./;
        expectError(
            validationResult, re,
            {
                node: validationResult.document.parseResult.value.interfaces[0],
                property: {name: 'name'},
                code: IssueCodes.DuplicateType
            }
        );
        expectError(
            validationResult, re,
            {
                node: validationResult.document.parseResult.value.interfaces[1],
                property: {name: 'name'},
                code: IssueCodes.DuplicateType
            }
        );
    });

    test('Parser rule should not trigger duplicate interface diagnostic', async () => {
        const validationResult = await validate(`
        grammar T
        interface Dupe { a: string }
        entry Dupe: 'dupe' a=ID;
        terminal ID returns string: /[a-z]+/;
        `);
        // Expect that we have no unique issues in this case
        expectNoIssues(validationResult, {
            node: validationResult.document.parseResult.value.interfaces[0],
            property: {name: 'name'},
        });
    });

    test('Duplicated property should be flagged for removal', async () => {
        const validationResult = await validate(`
        grammar T
        interface D1 { dup: string }
        interface D2 extends D1 { dup: string }
        `);
        // Property error applies to all members
        expectError(validationResult, /A property 'dup' has to be unique for the whole hierarchy./, {
            node: validationResult.document.parseResult.value.interfaces[0].attributes[0],
            property: {name: 'name'},
            code: IssueCodes.DuplicateProperty
        });
        expectError(validationResult, /A property 'dup' has to be unique for the whole hierarchy./, {
            node: validationResult.document.parseResult.value.interfaces[1].attributes[0],
            property: {name: 'name'},
            code: IssueCodes.DuplicateProperty
        });
    });

    test('Missing return should be added to parser rule', async () => {
        const validationResult = await validate(`
        grammar T
        interface T { a: string }
        T: 't' a=ID;
        terminal ID returns string: /[a-z]+/;
        `);
        expectError(validationResult, /The type 'T' is already explicitly declared and cannot be inferred./, {
            node: validationResult.document.parseResult.value.rules[0],
            property: {name: 'name'},
            code: IssueCodes.MissingReturns
        });
    });

    test('Invalid infers should be flagged for change to return', async () => {
        const validationResult = await validate(`
        grammar T
        interface T { a: string }
        T infers T: 't' a=ID;
        terminal ID returns string: /[a-z]+/;
        `);
        expectError(validationResult, /The type 'T' is already explicitly declared and cannot be inferred./, {
            node: validationResult.document.parseResult.value.rules[0] as ParserRule,
            property: {name: 'inferredType'},
            code: IssueCodes.InvalidInfers
        });
    });
});