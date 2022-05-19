/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices, Grammar, LangiumDocument } from '../../src';
import { expectError, expectWarning, parseHelper, validationHelper } from '../../src/test';

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

    let diagnostics: Diagnostic[];

    beforeAll(async () => {
        diagnostics = await validate(input);
    });

    test('CrossReference validation', () => {
        expectError(diagnostics, "Use the rule type 'DefType' instead of the typed rule name 'Definition' for cross references.");
    });

    test('AtomType validation', () => {
        expectError(diagnostics, "Use the rule type 'RefType' instead of the typed rule name 'Reference' for cross references.");
    });

});

describe('Checked Named CrossRefs', () => {
    const input = `
    grammar g
    A: 'a' name=ID;
    B: 'b' name=[A];
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let diagnostics: Diagnostic[];

    beforeAll(async () => {
        diagnostics = await validate(input);
    });

    test('Named crossReference warning', () => {
        expectWarning(diagnostics, 'The "name" property is not recommended for cross-references.');
    });
});