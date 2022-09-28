/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices, EmptyFileSystem, findNameAssignment, getEntryRule, Grammar, stream } from '../../src';
import { InferredType, isParserRule, isTerminalRule, ParserRule, TerminalRule } from '../../src/grammar/generated/ast';
import { LangiumGrammarGrammar } from '../../src/grammar/generated/grammar';
import { getTypeName, isDataTypeRule, terminalRegex } from '../../src/grammar/internal-grammar-util';
import { parseHelper } from '../../src/test';

describe('Data type rules', () => {

    const services = createLangiumGrammarServices(EmptyFileSystem);
    const parser = parseHelper<Grammar>(services.grammar);
    const grammar = `
    grammar Test
    terminal A: 'A';
    entry Main: value=NormalDataTypeRule;
    NormalDataTypeRule: A '.' A;
    RecursiveDataTypeRule1: RecursiveDataTypeRule2? A;
    RecursiveDataTypeRule2: RecursiveDataTypeRule1? A;
    `;

    let rules: ParserRule[] = [];

    beforeAll(async () => {
        rules = (await parser(grammar)).parseResult.value.rules
            .filter(e => isParserRule(e))
            .map(e => e as ParserRule);
    });

    test('Entry rule is not a data type rule', () => {
        const main = rules[0];
        expect(isDataTypeRule(main)).toBeFalsy();
    });

    test('Normal data type rule is correctly indentified', () => {
        const normal = rules[1];
        expect(isDataTypeRule(normal)).toBeTruthy();
    });

    test('Recursive data type rules are correctly indentified', () => {
        const recursive1 = rules[2];
        const recursive2 = rules[3];
        expect(isDataTypeRule(recursive1)).toBeTruthy();
        expect(isDataTypeRule(recursive2)).toBeTruthy();
    });

});

describe('Find name assignment in parser rules', () => {

    const services = createLangiumGrammarServices(EmptyFileSystem);
    const parser = parseHelper<Grammar>(services.grammar);
    const grammar = `
    grammar Test
    terminal ID: 'ID';
    DirectName: name=ID;
    IndirectName: DirectName value=ID;
    MissingName: value=ID;
    A infers B: 'a' name=ID (otherA=[B])?;
    `;

    let rules: ParserRule[] = [];

    beforeAll(async () => {
        rules = (await parser(grammar)).parseResult.value.rules
            .filter(e => isParserRule(e))
            .map(e => e as ParserRule);
    });

    test('Should find direct name', () => {
        const direct = rules[0];
        const nameAssignment = findNameAssignment(direct);
        expect(nameAssignment?.feature).toBe('name');
    });

    test('Should determine that name is missing', () => {
        const indirect = rules[1];
        const nameAssignment = findNameAssignment(indirect);
        expect(nameAssignment?.feature).toBe('name');
    });

    test('Should determine that name is missing', () => {
        const missing = rules[2];
        const nameAssignment = findNameAssignment(missing);
        expect(nameAssignment).toBe(undefined);
    });

    test('Should be able to find a named assignment by InferredType', () => {
        const a = rules[3];
        const nameAssigment = findNameAssignment(a);
        expect(nameAssigment?.feature).toBe('name');
    });

});

test('Langium grammar entry rule', () => {
    expect(getEntryRule(LangiumGrammarGrammar())?.name).toBe('Grammar');
});

describe('Get Name from Type', () => {

    const typeName = 'Parameter';

    test('Should get name for AbstractType', () => {
        //AbstractType case
        expect(getTypeName({
            name: typeName,
            $type: 'Type'
        } as InferredType)).toBe(typeName);
    });

    test('Should get name for InferredType', () => {
        //InferredType case
        expect(getTypeName({
            name: typeName,
            $type: 'InferredType'
        } as InferredType)).toBe(typeName);
    });

    test('Should throw error for Unknown Type', () => {
        // Unknown Type case
        expect(() => getTypeName({
            name: typeName,
            $type: 'BadType'
        } as InferredType)).toThrow('Cannot get name of Unknown Type');
    });
});

describe('TerminalRule to regex', () => {

    test('Should create empty keyword', async () => {
        const terminal = await getTerminal("terminal X: '';");
        const regex = terminalRegex(terminal);
        expect(regex).toBe('');
    });

    test('Should create keyword with escaped characters', async () => {
        const terminal = await getTerminal("terminal X: '(';");
        const regex = terminalRegex(terminal);
        expect(regex).toBe('\\(');
    });

    test('Should create combined regexes', async () => {
        const terminal = await getTerminal('terminal X: /x/ /y/;');
        const regex = terminalRegex(terminal);
        expect(regex).toBe('(xy)');
    });

    test('Should create optional alternatives with keywords', async () => {
        const terminal = await getTerminal("terminal X: ('a' | 'b')?;");
        const regex = terminalRegex(terminal);
        expect(regex).toBe('(a|b)?');
    });

    test('Should create terminal reference in terminal definition', async () => {
        const terminal = await getTerminal(`
        terminal X: Y Y;
        terminal Y: 'a';
        `, 'X');
        const regex = terminalRegex(terminal);
        expect(regex).toBe('((a)(a))');
    });

    test('Should create negated token', async () => {
        const terminal = await getTerminal("terminal X: !'a';");
        const regex = new RegExp(`^${terminalRegex(terminal)}$`);
        expect('a').not.toMatch(regex);
        expect('b').toMatch(regex);
        expect('c').toMatch(regex);
    });

    test('Should create character ranges', async () => {
        const terminal = await getTerminal("terminal X: 'a'..'b';");
        const regex = new RegExp(`^${terminalRegex(terminal)}$`);
        expect('a').toMatch(regex);
        expect('b').toMatch(regex);
        expect('c').not.toMatch(regex);
    });

    test('Should create wildcards', async () => {
        const terminal = await getTerminal('terminal X: .;');
        const regex = new RegExp(`^${terminalRegex(terminal)}$`);
        expect('a').toMatch(regex);
        expect(':').toMatch(regex);
        expect('ab').not.toMatch(regex);
    });

    test('Should create until tokens', async () => {
        const terminal = await getTerminal("terminal X: 'a'->'b';");
        const regex = new RegExp(`^${terminalRegex(terminal)}$`);
        expect('ab').toMatch(regex);
        expect('a some value b').toMatch(regex);
    });

    const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const parse = parseHelper<Grammar>(services);

    async function getTerminal(input: string, name?: string): Promise<TerminalRule> {
        const text = `
        grammar Test
        ${input}
        `;
        const grammar = (await parse(text)).parseResult.value;
        const terminals = stream(grammar.rules).filter(isTerminalRule);
        const terminal = name ? terminals.find(e => e.name === name) : terminals.head();
        if (!terminal) {
            throw new Error('Could not find terminal');
        }
        return terminal;
    }
});
