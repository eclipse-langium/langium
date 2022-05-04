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

describe('Validate that cross-references are not named as "name"', () => {
    const grammar = `
    grammar HelloWorld
    entry Model:
        (persons+=Person | greetings+=Greeting)*;
    Person:
        'person' name=ID;
    Greeting:
        'Hello' name=[Person] '!';
    
    hidden terminal WS: /\s+/;
    terminal ID: /[_a-zA-Z][\w_]*/;
    `;

    let validationData: ValidatorData;

    beforeAll(async () => {
        validationData = await parseAndValidate(grammar);
    });

    test('Named crossReference warning', () => {
        expectWarning(validationData, 'We recommend not to use the "name" property for cross-references.');
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

function expecting(severity: DiagnosticSeverity) {
  return function(data: ValidatorData, msg: string, at?: string): void {
    const found: { msg?: string; at?: string } = {};
    for (const diagnostic of data.diagnostics.filter(d => d.severity === severity)) {
        if (diagnostic.message === msg) {
            found.msg = diagnostic.message;
            if (at) {
                const diagnosticMarkedText = data.document.textDocument.getText(diagnostic.range);
                found.at = diagnosticMarkedText;
                if (at === diagnosticMarkedText) {
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
}

const expectError = expecting(DiagnosticSeverity.Error);
const expectWarning = expecting(DiagnosticSeverity.Warning);