/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { describe, expect, test } from 'vitest';
import { IssueCodes } from '../../../src/grammar/index.js';
import { createLangiumGrammarServices } from '../../../src/grammar/langium-grammar-module.js';
import { testQuickFix } from '../../../src/test/langium-test.js';

const services = createLangiumGrammarServices(EmptyFileSystem);
const testQuickFixes = testQuickFix(services.grammar);

// Some of these test data are exported, since they are reused for corresponding test cases for the grammar validation itself

export const beforeTwoAlternatives = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    Person: (Neighbor | Friend); // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const expectedTwoAlternatives = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    type Person = Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const beforeSinglelternative = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    Person: Neighbor; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const expectedSingleAlternative = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    type Person = Neighbor; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const beforeWithInfers = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    Person infers PersonType: Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[PersonType:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const expectedWithInfers = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    type PersonType = Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[PersonType:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

describe('Langium grammar quick-fixes for validations: Parser rules used only as type in cross-references are not marked as unused, but with a hint suggesting a type declaration', () => {
    // these test cases target https://github.com/eclipse-langium/langium/issues/1309

    test('The parser rule has an implicitly inferred type', async () => {
        await testLogic(beforeTwoAlternatives, expectedTwoAlternatives);
    });

    test('The parser rule has an implicitly inferred type', async () => {
        await testLogic(beforeSinglelternative, expectedSingleAlternative);
    });

    test('The parser rule has an explicitly inferred type', async () => {
        await testLogic(beforeWithInfers, expectedWithInfers);
    });

    async function testLogic(textBefore: string, textAfter: string) {
        const result = await testQuickFixes(textBefore, IssueCodes.ParserRuleToTypeDecl, textAfter);
        const action = result.action;
        expect(action).toBeTruthy();
        expect(action!.title).toBe('Replace parser rule by type declaration');
    }

    // TODO test cases, where no quick-fix action is provided
});
