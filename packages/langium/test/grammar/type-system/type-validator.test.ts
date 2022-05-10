/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices, isGrammar, toDiagnosticSeverity } from '../../../src';
import { parseDocument } from '../../../src/test';

const grammarServices = createLangiumGrammarServices().grammar;

describe('validate optional params in types', () => {

    // tests that an optional param in a declared type can be optionally present in a rule
    test('optional param should not invalidate type', async () => {
        const prog = `
        grammar g
        interface MyType {
            name: string
            count?: number
        }
        X returns MyType : name=ID;
        Y returns MyType : name=ID count=NUMBER;
        `.trim();

        const document = await parseDocument(grammarServices, prog);

        if(isGrammar(document.parseResult.value)) {
            // verify we have no error diagnostics
            const validationItems: DiagnosticSeverity[] = [];
            grammarServices.validation.LangiumGrammarValidator.checkTypesConsistency(document.parseResult.value, (severity: 'error' | 'warning' | 'info' | 'hint') => {
                if(severity === 'error') {
                    validationItems.push(toDiagnosticSeverity(severity));
                }
            });
            expect(validationItems).toHaveLength(0);
        } else {
            // something else went wrong
            fail('Could not extract Grammar from document');
        }
    });

});