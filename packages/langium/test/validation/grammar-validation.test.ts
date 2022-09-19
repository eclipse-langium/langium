/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices, EmptyFileSystem } from '../../src';
import { Assignment, CrossReference, Grammar, Group, ParserRule } from '../../src/grammar/generated/ast';
import { IssueCodes } from '../../src/grammar/langium-grammar-validator';
import { expectError, expectIssue, expectNoIssues, expectWarning, validationHelper, ValidationResult } from '../../src/test';

const services = createLangiumGrammarServices(EmptyFileSystem);
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
        const range = { start: { character: 16, line: 1 }, end: { character: 24, line: 1 } };
        expectError(validationResult, 'Cannot use rule fragments in types.', { range });
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

describe('Unordered group validations', () => {

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
        expect(validation.diagnostics).toHaveLength(1);
        const errorText = '("edition" version=STRING)?';
        const offset = validation.document.textDocument.getText().indexOf(errorText);
        expectError(validation, 'Optional elements in Unordered groups are currently not supported', { offset: offset, length: errorText.length, code: IssueCodes.OptionalUnorderedGroup } );
    });
});

describe('Unused rules validation', () => {

    test('Should not create validate for indirectly used terminal', async () => {
        const text = `
        grammar TestUsedTerminals
        
        entry Used: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: 'a' STRING;
        terminal STRING: /"[^"]*"|'[^']*'/;
        `;
        const validation = await validate(text);
        expectNoIssues(validation);
    });

    test('Unused terminals are correctly identified', async () => {
        const text = `
        grammar TestUnusedTerminals
        
        entry Used: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal STRING: /"[^"]*"|'[^']*'/;
        `;
        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(1);
        const stringTerminal = validation.document.parseResult.value.rules.find(e => e.name === 'STRING')!;
        expectIssue(validation, {
            node: stringTerminal,
            property: {
                name: 'name'
            },
            severity: DiagnosticSeverity.Hint
        });
    });

    test('Unused parser rules are correctly identified', async () => {
        const text = `
        grammar TestUnusedParserRule
        
        entry Used: name=ID;
        Unused: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const validation = await validate(text);
        expect(validation.diagnostics).toHaveLength(1);
        const unusedRule = validation.document.parseResult.value.rules.find(e => e.name === 'Unused')!;
        expectIssue(validation, {
            node: unusedRule,
            property: {
                name: 'name'
            },
            severity: DiagnosticSeverity.Hint
        });
    });

});
