/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices } from '../../../src/node';
import { parseDocument } from '../../../src/test';

const grammarServices = createLangiumGrammarServices().grammar;

describe('validate params in types', () => {

    // verifies that missing properties that are required are reported in the correct spot
    test('verify missing required property error, for single rule', async () => {
        const prog = `
        interface B {
            name:string
            count?:string
        }
        X2 returns B: count=ID;
        terminal ID: /[a-zA-Z_][\\w_]*/;
        `.trim();
        // verify we only have 1 error, associated with a missing 'name' prop
        const document = await parseDocument(grammarServices, prog);
        let diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        diagnostics = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
        expect(diagnostics).toHaveLength(1);

        // verify location of diagnostic
        const d = diagnostics[0];
        expect(d.range.start).toEqual({character: 8, line: 4});
        expect(d.range.end).toEqual({character: 10, line: 4});
    });

    // verifies that missing required params use the right msg & position
    test('verify missing required param error is present for the correct rule', async () => {
        const prog = `
        interface A {
            name:string
            count?:number
        }
        X returns A: name=ID;
        Y returns A: count=NUMBER;
        terminal ID: /[a-zA-Z_][\\w_]*/;
        terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
        `.trim();

        // expect exactly 2 errors, associated with a missing 'name' prop for type 'A'
        const document = await parseDocument(grammarServices, prog);
        let diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        diagnostics = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
        expect(diagnostics).toHaveLength(1);

        // verify the location of the single diagnostic error, should be only for the 2nd rule
        const d = diagnostics[0];
        expect(d.range.start).toEqual({character: 8, line: 5});
        expect(d.range.end).toEqual({character: 34, line: 5});
    });

    // tests that an optional param in a declared type can be optionally present in a rule
    test('optional param should not invalidate type', async () => {
        const prog = `
        interface MyType {
            name: string
            count?: number
        }
        X returns MyType : name=ID;
        Y returns MyType : name=ID count=NUMBER;
        terminal ID: /[a-zA-Z_][\\w_]*/;
        terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
        `.trim();

        // verify we have no errors
        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(0);
    });

});

describe('validate inferred types', () => {

    test('inferred type in cross-reference should not produce an error', async () => {
        const prog = `
        A infers B: 'a' name=ID (otherA=[B])?;
        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim();

        const document = await parseDocument(grammarServices, prog);
        const diagnostics: Diagnostic[] = await grammarServices.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(0);

    });
});
