/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Diagnostic } from 'vscode-languageserver';
import { createLangiumGrammarServices, Grammar, LangiumDocument } from '../../src';
import { parseHelper } from '../../src/test';

describe('Grammar validation', () => {
    const grammarText = `
    grammar Test

    interface X {
      name: string;
    }

    entry Main: {X} count=NUMBER;
    terminal NUMBER returns number: /[0-9]+/;
    `;

    let validationResult: ValidatorData;
    beforeAll(async () => {
        validationResult = await parseAndValidate(grammarText);
    });

    test('Property is unknown in the definition of X.', () => {
        const errors = validationResult.diagnostics.filter(d => /A property 'name' is expected in a rule that returns type 'X'./.test(d.message));
        expect(errors.length).toBe(1);
    });

});

//TODO remove
interface ValidatorData {
    document: LangiumDocument;
    diagnostics: Diagnostic[];
}
const services = createLangiumGrammarServices();
const parser = parseHelper<Grammar>(services.grammar);
async function parseAndValidate(grammar: string): Promise<ValidatorData> {
    const doc = await parser(grammar);
    const diagnostics = await services.grammar.validation.DocumentValidator.validateDocument(doc);
    return {
        document: doc,
        diagnostics: diagnostics
    };
}