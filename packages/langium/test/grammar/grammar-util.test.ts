/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices, getEntryRule, Grammar, isTerminalRule, replaceTokens, stream, terminalRegex, TerminalRule } from '../../src';
import { LangiumGrammarGrammar } from '../../src/grammar/generated/grammar';
import { parseHelper } from '../../src/test';

describe('Token replacement', () => {

    test('should keep normal keywords', () => {
        expect(replaceTokens('public')).toBe('Public');
    });

    test('should replace whitespace', () => {
        expect(replaceTokens('with value')).toBe('WithWhitespacevalue');
        expect(replaceTokens('with    value')).toBe('WithWhitespacevalue');
        expect(replaceTokens('with\tvalue')).toBe('WithWhitespacevalue');
    });

    test('should replace special characters', () => {
        expect(replaceTokens('/')).toBe('Slash');
        expect(replaceTokens('\\')).toBe('Backslash');
        expect(replaceTokens('#')).toBe('Hash');
        expect(replaceTokens('!')).toBe('ExclamationMark');
    });

    test('should replace other unicode characters', () => {
        expect(replaceTokens('❤')).toBe('u10084');
        expect(replaceTokens('Ö')).toBe('u214');
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

    const services = createLangiumGrammarServices().ServiceRegistry.all[0];
    const parse = parseHelper<Grammar>(services);

    async function getTerminal(input: string, name?: string): Promise<TerminalRule> {
        const text = `
        grammar Test
        ${input}
        `;
        const grammar = (await parse(text)).document.parseResult.value;
        const terminals = stream(grammar.rules).filter(isTerminalRule);
        const terminal = name ? terminals.find(e => e.name === name) : terminals.head();
        if (!terminal) {
            throw new Error('Could not find terminal');
        }
        return terminal;
    }
});
