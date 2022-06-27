/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src/node';
import { Assignment, CrossReference, Grammar, Group, ParserRule } from '../../src/grammar/generated/ast';
import { IssueCodes } from '../../src/grammar/langium-grammar-validator';
import { expectError, expectNoIssues, expectWarning, validationHelper, ValidationResult } from '../../src/test';

const services = createLangiumGrammarServices();
const validate = validationHelper<Grammar>(services.grammar);

describe('checkReferenceToRuleButNotType', () => {

    const input = `
        grammar CrossRefs

        entry Model:
            'model' name=ID
            (elements+=Element)*;
        
        type AbstractElement = Reference | string;
        
        Element:
            Definition | Reference;
        
        Definition infers DefType:
            name=ID;
        Reference infers RefType:
            ref=[Definition];
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('CrossReference validation', () => {
        const rule = ((validationResult.document.parseResult.value.rules[3] as ParserRule).definition as Assignment).terminal as CrossReference;
        expectError(validationResult, "Use the rule type 'DefType' instead of the typed rule name 'Definition' for cross references.", {
            node: rule,
            property: { name: 'type' }
        });
    });

    test('AtomType validation', () => {
        const type = validationResult.document.parseResult.value.types[0];
        expectError(validationResult, "Use the rule type 'RefType' instead of the typed rule name 'Reference' for cross references.", {
            node: type,
            property: { name: 'typeAlternatives' }
        });
    });

});

describe('Check Rule Fragment Validation', () => {
    const grammar = `
    grammar g
    type Type = Fragment;
    fragment Fragment: name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('Rule Fragment Validation', () => {
        const fragmentType = validationResult.document.parseResult.value.types[0];
        expectError(validationResult, 'Cannot use rule fragments in types.', { node: fragmentType, property: { name: 'typeAlternatives' } });
    });
});

describe('Checked Named CrossRefs', () => {
    const input = `
    grammar g
    A: 'a' name=ID;
    B: 'b' name=[A];
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('Named crossReference warning', () => {
        const rule = ((validationResult.document.parseResult.value.rules[1] as ParserRule).definition as Group).elements[1] as Assignment;
        expectWarning(validationResult, 'The "name" property is not recommended for cross-references.', {
            node: rule,
            property: { name: 'feature' }
        });
    });
});

describe('Check grammar with primitives', () => {
    const grammar = `
    grammar PrimGrammar
    entry Expr:
        (String | Bool | Num | BigInt | DateObj)*;
    String:
        'String' val=STR;
    Bool:
        'Bool' val?='true';
    Num:
        'Num' val=NUM;
    BigInt:
        'BigInt' val=BIG 'n';
    DateObj:
        'Date' val=DATE;
    terminal STR: /[_a-zA-Z][\\w_]*/;
    terminal BIG returns bigint: /[0-9]+(?=n)/;
    terminal NUM returns number: /[0-9]+(\\.[0-9])?/;
    terminal DATE returns Date: /[0-9]{4}-{0-9}2-{0-9}2/+;
    `.trim();

    let validationResult: ValidationResult<Grammar>;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationResult = await validate(grammar);
    });

    test('No validation errors in grammar', () => {
        expectNoIssues(validationResult);
    });
});

describe('Grammar Validator tests', () => {

    test('Unsupported optional element in unordered group error', async () => {
        const text = `
        grammar TestUnorderedGroup
        
        entry Book: 
            'book' name=STRING 
            (
                  ("description" descr=STRING)
                & ("edition" version=STRING)?
                & ("author" author=STRING)
            )
        ;
        hidden terminal WS: /\\s+/;
        terminal STRING: /"[^"]*"|'[^']*'/;
        `;

        const validation = await validate(text);
        expect(validation.diagnostics.length).toBe(1);
        const range = { start: { character: 18, line: 7 }, end: { character: 45, line: 7 } };
        expectError(validation, 'Optional elements in Unordered groups are currently not supported', { range, code: IssueCodes.OptionalUnorderedGroup } );
    });
});
