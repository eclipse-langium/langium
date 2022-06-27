/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src/node';
import { Assignment, Grammar, ParserRule } from '../../src/grammar/generated/ast';
import { expectError, validationHelper } from '../../src/test';

const services = createLangiumGrammarServices();
const validate = validationHelper<Grammar>(services.grammar);

describe('Langium grammar validation', () => {
    test('Parser rule should not assign fragments', async () => {
        // arrange
        const grammarText = `
        grammar Test
        entry A: b=B;
        fragment B: name=ID;
        terminal ID returns string: /[a-z]+/;
        `;

        // act
        const validationResult = await validate(grammarText);

        // assert
        expectError(validationResult, /Cannot use fragment rule 'B' for assignment of property 'b'./, {
            node: (validationResult.document.parseResult.value.rules[0] as ParserRule).definition as Assignment,
            property: {name: 'terminal'}
        });
    });
});