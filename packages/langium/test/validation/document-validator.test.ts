/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Position, Range } from 'vscode-languageserver';
import { AstNode, createServicesForGrammar } from '../../src';
import { validationHelper, ValidationResult } from '../../src/test';

// Related to https://github.com/langium/langium/issues/571
describe('Parser error is thrown on resynced token with NaN position', () => {

    const grammar = `grammar HelloWorld

    entry Model:
        (persons+=Person | greetings+=Greeting)+;
    
    Person:
        'person' name=ID;
    
    Greeting:
        'Hello' person=[Person:ID] '!';
    
    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    terminal INT returns number: /[0-9]+/;
    terminal STRING: /"[^"]*"|'[^']*'/;
    `;

    let validate: (input: string) => Promise<ValidationResult<AstNode>>;

    beforeEach(async () => {
        const services = await createServicesForGrammar({
            grammar
        });
        validate = validationHelper(services);
    });

    test('Diagnostic is shown on at the end of the previous token', async () => {
        const text = `person Aasdf
        person Jo
        
        Hello Jo!
        Hello `;

        const validationResult = await validate(text);
        const diagnostics = validationResult.diagnostics;
        expect(diagnostics).toHaveLength(1);
        const endPosition = Position.create(4, 13);
        expect(diagnostics[0].range).toStrictEqual(Range.create(endPosition, endPosition));
    });

    test('Diagnostic is shown at document start when document is empty', async () => {
        const validationResult = await validate('');
        const diagnostics = validationResult.diagnostics;
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].range).toStrictEqual(Range.create(0, 0, 0, 0));
    });
});
