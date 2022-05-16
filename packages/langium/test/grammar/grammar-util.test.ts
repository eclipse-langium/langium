/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, createLangiumGrammarServices, createLangiumParser, findNameAssignment, getEntryRule, Grammar, inject, IParserConfig, isDataTypeRule, isParserRule, isTerminalRule, LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumParser, LangiumServices, LangiumSharedServices, Module, ParserRule, stream, terminalRegex, TerminalRule } from '../../src';
import { LangiumGrammarGrammar } from '../../src/grammar/generated/grammar';
import { parseHelper } from '../../src/test';

const grammarServices = createLangiumGrammarServices().grammar;
const helper = parseHelper<Grammar>(grammarServices);

describe('Verify type resolution', () => {

    test('verify no TypeError for InferredType in scope', async () => {
        const c = `
        type T = A;
        B returns A: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim();

        const g = (await helper(c)).parseResult.value;

        expect(() => {
            parserFromGrammar(g);
        }).not.toThrow();
    });

    test('verify data type rule can be inferred for cross reference', async () => {
        const c = `
        A infers B: 'a' name=ID (otherA=[B])?;
        hidden terminal WS: /\\s+/;
        terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
        `.trim();

        const g = (await helper(c)).parseResult.value;

        expect(() => {
            parserFromGrammar(g);
        }).not.toThrow();
    });

});

describe('Data type rules', () => {

    const services = createLangiumGrammarServices();
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

    const services = createLangiumGrammarServices();
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

    test('Should be able to infer data type rule for cross ref', () => {
        const a = rules[3];
        const nameAssigment = findNameAssignment(a);
        expect(nameAssigment?.feature).toBe('name');
    });

});

test('Langium grammar entry rule', () => {
    expect(getEntryRule(LangiumGrammarGrammar())?.name).toBe('Grammar');
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
        expect(regex).toBe('xy');
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
        expect(regex).toBe('aa');
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

    const services = createLangiumGrammarServices().grammar;
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

function parserFromGrammar(grammar: Grammar): LangiumParser {
    const parserConfig: IParserConfig = {
        skipValidations: false
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unavailable: () => any = () => ({});
    const generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
        AstReflection: unavailable,
    };
    const generatedModule: Module<LangiumServices, LangiumGeneratedServices> = {
        Grammar: () => grammar,
        LanguageMetaData: unavailable,
        parser: {
            ParserConfig: () => parserConfig
        }
    };
    const shared = inject(createDefaultSharedModule(), generatedSharedModule);
    const services = inject(createDefaultModule({ shared }), generatedModule);
    return createLangiumParser(services);
}
