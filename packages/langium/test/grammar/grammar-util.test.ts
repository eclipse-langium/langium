/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, GrammarAST as GrammarTypes} from 'langium';
import { beforeAll, describe, expect, test } from 'vitest';
import { EmptyFileSystem, GrammarUtils, stream, GrammarAST } from 'langium';
import { LangiumGrammarGrammar, createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';

const { isDataTypeRule, findNameAssignment, getEntryRule, getTypeName, terminalRegex } = GrammarUtils;

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

    let rules: GrammarAST.ParserRule[] = [];

    beforeAll(async () => {
        rules = (await parser(grammar)).parseResult.value.rules
            .filter(e => GrammarAST.isParserRule(e))
            .map(e => e as GrammarAST.ParserRule);
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

    let rules: GrammarAST.ParserRule[] = [];

    beforeAll(async () => {
        rules = (await parser(grammar)).parseResult.value.rules
            .filter(e => GrammarAST.isParserRule(e))
            .map(e => e as GrammarTypes.ParserRule);
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
            $type: 'Type',
        } as unknown as GrammarTypes.InferredType)).toBe(typeName);
    });

    test('Should get name for InferredType', () => {
        //InferredType case
        expect(getTypeName({
            name: typeName,
            $type: 'InferredType'
        } as GrammarTypes.InferredType)).toBe(typeName);
    });

    test('Should throw error for Unknown Type', () => {
        // Unknown Type case
        expect(() => getTypeName({
            name: typeName,
            $type: 'BadType'
        } as unknown as GrammarTypes.InferredType)).toThrow('Cannot get name of Unknown Type');
    });
});

describe('TerminalRule to regex', () => {

    test('Should create keyword with escaped characters', async () => {
        const terminal = await getTerminal("terminal X: '(';");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/\(/);
    });

    test('Should create combined regexes', async () => {
        const terminal = await getTerminal('terminal X: /x/ /y/;');
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(xy)/);
    });

    test('Should create optional alternatives with keywords', async () => {
        const terminal = await getTerminal("terminal X: ('a' | 'b')?;");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(a|b)?/);
    });

    test('Should create positive lookahead group with single element', async () => {
        const terminal = await getTerminal("terminal X: 'a' (?='b');");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(a(?=b))/);
    });

    test('Should create positive lookahead group with multiple elements', async () => {
        const terminal = await getTerminal("terminal X: 'a' (?='b' 'c' 'd');");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(a(?=bcd))/);
    });

    test('Should create negative lookahead group', async () => {
        const terminal = await getTerminal("terminal X: 'a' (?!'b');");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(a(?!b))/);
    });

    test('Should create negative lookbehind group', async () => {
        const terminal = await getTerminal("terminal X: 'a' (?<!'b');");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(a(?<!b))/);
    });

    test('Should create positive lookbehind group', async () => {
        const terminal = await getTerminal("terminal X: 'a' (?<='b');");
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/(a(?<=b))/);
    });

    test('Should create terminal reference in terminal definition', async () => {
        const terminal = await getTerminal(`
        terminal X: Y Y;
        terminal Y: 'a';
        `, 'X');
        const regex = terminalRegex(terminal);
        expect(regex).toEqual(/((a)(a))/);
    });

    test('Should create negated token', async () => {
        const terminal = await getTerminal("terminal X: !'a';");
        const regex = new RegExp(`^${terminalRegex(terminal).source}$`);
        expect('a').not.toMatch(regex);
        expect('b').toMatch(regex);
        expect('c').toMatch(regex);
    });

    test('Should create character ranges', async () => {
        const terminal = await getTerminal("terminal X: 'a'..'b';");
        const regex = new RegExp(`^${terminalRegex(terminal).source}$`);
        expect('a').toMatch(regex);
        expect('b').toMatch(regex);
        expect('c').not.toMatch(regex);
    });

    test('Should create wildcards', async () => {
        const terminal = await getTerminal('terminal X: .;');
        const regex = new RegExp(`^${terminalRegex(terminal).source}$`);
        expect('a').toMatch(regex);
        expect(':').toMatch(regex);
        expect('ab').not.toMatch(regex);
    });

    test('Should create until tokens', async () => {
        const terminal = await getTerminal("terminal X: 'a'->'b';");
        const regex = new RegExp(`^${terminalRegex(terminal).source}$`);
        expect('ab').toMatch(regex);
        expect('a some value b').toMatch(regex);
    });

    const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const parse = parseHelper<Grammar>(services);

    async function getTerminal(input: string, name?: string): Promise<GrammarAST.TerminalRule> {
        const text = `
        grammar Test
        ${input}
        `;
        const grammar = (await parse(text)).parseResult.value;
        const terminals = stream(grammar.rules).filter(GrammarAST.isTerminalRule);
        const terminal = name ? terminals.find(e => e.name === name) : terminals.head();
        if (!terminal) {
            throw new Error('Could not find terminal');
        }
        return terminal;
    }
});
