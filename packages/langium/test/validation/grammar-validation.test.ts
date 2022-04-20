/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { createLangiumGrammarServices, Grammar, LangiumDocument } from '../../src';
import { parseHelper } from '../../src/test';

const services = createLangiumGrammarServices();
const parser = parseHelper<Grammar>(services.grammar);

describe('checkReferenceToRuleButNotType', () => {

    const grammar = `
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

    let validationData: ValidatorData;

    beforeAll(async () => {
        validationData = await parseAndValidate(grammar);
    });

    test('CrossReference validation', () => {
        expectError(validationData, "Use the rule type 'DefType' instead of the typed rule name 'Definition' for cross references.", 'Definition');
    });

    test('AtomType validation', () => {
        expectError(validationData, "Use the rule type 'RefType' instead of the typed rule name 'Reference' for cross references.", 'Reference');
    });

});

interface ValidatorData {
    document: LangiumDocument;
    diagnostics: Diagnostic[];
}

async function parseAndValidate(grammar: string): Promise<ValidatorData> {
    const doc = await parser(grammar);
    const diagnostics = await services.grammar.validation.DocumentValidator.validateDocument(doc);
    return {
        document: doc,
        diagnostics: diagnostics
    };
}

function expectError(data: ValidatorData, msg: string, at?: string): void {
    const found: { msg?: string; at?: string } = {};
    for (const error of data.diagnostics.filter(isError)) {
        if (error.message === msg) {
            found.msg = error.message;
            if (at) {
                const errorMarkedText = data.document.textDocument.getText(error.range);
                found.at = errorMarkedText;
                if (at === errorMarkedText) {
                    return;
                }
            } else {
                return;
            }
        }
    }
    expect(found.msg).toBe(msg);
    if (at) {
        expect(found.at).toBe(at);
    }
}

function isError(d: Diagnostic): boolean {
    return d.severity === DiagnosticSeverity.Error;
}