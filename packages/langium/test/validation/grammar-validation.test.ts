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

describe('Check Rule Fragment Validation', () => {
    const grammar = `
    grammar g
    type Type = Fragment;
    fragment Fragment: name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationData: ValidatorData;

    beforeAll(async () => {
        validationData = await parseAndValidate(grammar);
    });

    test('Rule Fragment Validation', () => {
        expectError(validationData, 'Cannot use rule fragments in types.', 'Fragment');
    });
});

describe('Checked Named CrossRefs', () => {
    const grammar = `
    grammar g
    A: 'a' name=ID;
    B: 'b' name=[A];
    terminal ID: /[_a-zA-Z][\\w_]*/;
    `.trim();

    let validationData: ValidatorData;

    beforeAll(async () => {
        validationData = await parseAndValidate(grammar);
    });

    test('Named crossReference warning', () => {
        expectWarning(validationData, 'The "name" property is not recommended for cross-references.');
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

    let validationData: ValidatorData;

    // 1. build a parser from this grammar, verify it works
    beforeAll(async () => {
        validationData = await parseAndValidate(grammar);
    });

    test('No validation errors in grammar', () => {
        expect(validationData.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error)).toHaveLength(0);
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
    };
}

const expectError = expecting(DiagnosticSeverity.Error);
const expectWarning = expecting(DiagnosticSeverity.Warning);