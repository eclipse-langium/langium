/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { Grammar } from '../../src/grammar/generated/ast';
import { expectError, expectWarning, validationHelper, ValidationResult } from '../../src/test';

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
    `;

    let validationResult: ValidationResult<Grammar>;

    beforeAll(async () => {
        validationResult = await validate(input);
    });

    test('CrossReference validation', () => {
        const rule = validationResult.document.parseResult.value.rules[3];
        expectError(validationResult, "Use the rule type 'DefType' instead of the typed rule name 'Definition' for cross references.", {
            atNode: { node: rule }
        });
    });

    test('AtomType validation', () => {
        const type = validationResult.document.parseResult.value.types[0];
        expectError(validationResult, "Use the rule type 'RefType' instead of the typed rule name 'Reference' for cross references.", {
            atNode: { node: type }
        });
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
        const rule = validationResult.document.parseResult.value.rules[1];
        expectWarning(validationResult, 'The "name" property is not recommended for cross-references.', {
            atNode: { node: rule }
        });
    });
});