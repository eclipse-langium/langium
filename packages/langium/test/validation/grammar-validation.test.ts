/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices, Grammar } from '../../src';
import { parseHelper } from '../../src/test';

describe('Validation checks', () => {

    const services = createLangiumGrammarServices();
    const parser = parseHelper<Grammar>(services.grammar);
    const grammar = `
        grammar CrossRefs

        entry Model:
            'model' name=ID
            (elements+=Element)*;
        
        type AbstractElement = Reference | string;
        
        Element:
            Definition | Reference;
        
        Definition returns DefType:
            name=ID;
        Reference returns RefType:
            ref=[Definition];
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `;

    let diagnostics: Diagnostic[] = [];

    beforeAll(async () => {
        const parsedDoc = await parser(grammar);
        diagnostics = await services.grammar.validation.DocumentValidator.validateDocument(parsedDoc);
    });

    test('CrossReference validation', () => {
        const errors = diagnostics.filter(isError).map(d => d.message);
        expect(errors).toContain("Use the rule type 'DefType' instead of the typed rule 'Definition' for cross references.");
    });

    test('AtomType validation', () => {
        const errors = diagnostics.filter(isError).map(d => d.message);
        expect(errors).toContain("Use the rule type 'RefType' instead of the typed rule 'Reference' for cross references.");
    });

});
function isError(d: Diagnostic): boolean {
    return d.severity === DiagnosticSeverity.Error;
}