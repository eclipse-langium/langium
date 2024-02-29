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

export const beforeTwoAlternatives = grammarRuleVsType(`
    Person: Neighbor | Friend;
    Greeting: 'Hello' person=[Person:ID] '!';
`);

export const expectedTwoAlternatives = grammarRuleVsType(`
    type Person = Neighbor | Friend;
    Greeting: 'Hello' person=[Person:ID] '!';
`);

export const beforeSinglelternative = grammarRuleVsType(`
    Person: Neighbor;
    Greeting: 'Hello' person=[Person:ID] '!';
`);

export const expectedSingleAlternative = grammarRuleVsType(`
    type Person = Neighbor;
    Greeting: 'Hello' person=[Person:ID] '!';
`);

export const beforeAnotherRule = grammarRuleVsType(`
    Person: Neighbor | AnotherPerson;
    AnotherPerson: Friend;
    Greeting: 'Hello' person=[Person:ID] '!';
`);

export const expectedAnotherRule = grammarRuleVsType(`
    type Person = Neighbor | AnotherPerson;
    AnotherPerson: Friend;
    Greeting: 'Hello' person=[Person:ID] '!';
`);

export const beforeWithInfers = grammarRuleVsType(`
    Person infers PersonType: Neighbor | Friend;
    Greeting: 'Hello' person=[PersonType:ID] '!';
`);

export const expectedWithInfers = grammarRuleVsType(`
    type PersonType = Neighbor | Friend;
    Greeting: 'Hello' person=[PersonType:ID] '!';
`);

function grammarRuleVsType(body: string): string {
    return `
        grammar ParserRuleUsedOnlyForCrossReference
        entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
        Neighbor:   'neighbor'  name=ID;
        Friend:     'friend'    name=ID;
        ${body}
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `;
}

describe('Langium grammar quick-fixes for validations: Parser rules used only as type in cross-references are not marked as unused, but with a hint suggesting a type declaration', () => {
    // these test cases target https://github.com/eclipse-langium/langium/issues/1309

    test('The parser rule has an implicitly inferred type: two alternatives', async () => {
        await testReplaceAction(beforeTwoAlternatives, expectedTwoAlternatives);
    });

    test('The parser rule has an implicitly inferred type: single alternative', async () => {
        await testReplaceAction(beforeSinglelternative, expectedSingleAlternative);
    });

    test('The parser rule used a nested rule', async () => {
        await testReplaceAction(beforeAnotherRule, expectedAnotherRule);
    });

    test('The parser rule has an explicitly inferred type (with two alternatives)', async () => {
        await testReplaceAction(beforeWithInfers, expectedWithInfers);
    });

    async function testReplaceAction(textBefore: string, textAfter: string) {
        const result = await testQuickFixes(textBefore, IssueCodes.ParserRuleToTypeDecl, textAfter);
        const action = result.action;
        expect(action).toBeTruthy();
        expect(action!.title).toBe('Replace parser rule by type declaration');
    }
});
