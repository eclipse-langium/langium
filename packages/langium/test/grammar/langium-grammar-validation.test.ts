/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Assignment, createLangiumGrammarServices, Grammar, Group, ParserRule } from '../../src';
import { expectError, validationHelper, ValidationResult } from '../../src/test';

const services = createLangiumGrammarServices();
const validate = validationHelper<Grammar>(services.grammar);

describe('Grammar validation', () => {
    const grammarText = `
    grammar Test

    interface X {
      name: string;
    }

    entry Main: {X} count=NUMBER;
    terminal NUMBER returns number: /[0-9]+/;
    `.trim();

    let validationResult: ValidationResult<Grammar>;
    beforeAll(async () => {
        validationResult = await validate(grammarText);
    });

    test('Property "name" is expected in the rule Main.', () => {
        const node = validationResult.document.parseResult.value.rules[0] as ParserRule;
        expectError(validationResult, /A property 'name' is expected in a rule that returns type 'X'./, {
            node,
            property: {name: 'name'}
        });
    });

    test('Property "count" is unexpected in the rule Main.', () => {
        const node = ((validationResult.document.parseResult.value.rules[0] as ParserRule).alternatives as Group).elements[1] as Assignment;
        expectError(validationResult, /A property 'count' is not expected./, {
            node,
            property: {name: 'feature'}
        });
    });
});