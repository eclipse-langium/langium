/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { expectFindReferences } from '../../src/test';
import { expectFunction } from '../fixture';

const text = `
grammar test hidden(WS)

entry Model: value=RuleA;

interface <|>A {
    na<|>me: string
}

interface B extends A {
    assignmentB: string
}

type C = A | B;

RuleA returns A: na<|>me=ID;

RuleB returns B: na<|>me=ID assignmentB=ID;

RuleC returns C: na<|>me=ID assi<|>gnmentB=ID;

ActionRule: {A} 'A' na<|>me=ID | {B} name=ID assig<|>nmentB=ID | {C} na<|>me=ID assignmentB=ID;

terminal ID: /\\w+/;
terminal WS: /\\s+/;

`;

const grammarServices = createLangiumGrammarServices().grammar;
const findReferences = expectFindReferences(grammarServices, expectFunction);

describe('findReferences', () => {
    test('Must find all references to interface A from interface\'s name including declaration', async () => {
        await findReferences({
            text,
            index: 0,
            referencesCount: 5,
            includeDeclaration: true
        });
    });

    test('Must find all references to interface A from interface\'s name excluding declaration', async () => {
        await findReferences({
            text,
            index: 0,
            referencesCount: 4,
            includeDeclaration: false
        });
    });

    test('Must find all references to property name from interface A declaration', async () => {
        await findReferences({
            text,
            index: 1,
            referencesCount: 7,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property name from parser rule RuleA', async () => {
        await findReferences({
            text,
            index: 2,
            referencesCount: 7,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property name from parser RuleB', async () => {
        await findReferences({
            text,
            index: 3,
            referencesCount: 7,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property name from parser RuleC', async () => {
        await findReferences({
            text,
            index: 4,
            referencesCount: 7,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property assignmentB from parser ruleC', async () => {
        await findReferences({
            text,
            index: 5,
            referencesCount: 5,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property name from Action A', async () => {
        await findReferences({
            text,
            index: 6,
            referencesCount: 7,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property assignmentB from Action B', async () => {
        await findReferences({
            text,
            index: 7,
            referencesCount: 5,
            includeDeclaration: true
        });
    });

    test ('Must find all references to property name from Action C', async () => {
        await findReferences({
            text,
            index: 8,
            referencesCount: 7,
            includeDeclaration: true
        });
    });
});