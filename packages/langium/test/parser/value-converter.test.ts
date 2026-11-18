/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CstNode, Grammar, GrammarAST as GrammarTypes, ValueConverterKind, ValueType } from 'langium';
import { beforeAll, describe, expect, test } from 'vitest';
import { DefaultValueConverter, EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import { parseHelper } from 'langium/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(grammarServices);

describe('DefaultValueConverter', () => {

    test('should process escaped characters', async () => {
        const doc = await parse(`
            terminal A: 'a\\'\\n\\t\\\\';
        `);
        const terminalA = doc.parseResult.value.rules[0] as GrammarTypes.TerminalRule;
        expect(terminalA).toBeDefined();
        expect(terminalA.definition.$type).toBe(GrammarAST.CharacterRange.$type);
        expect((terminalA.definition as GrammarAST.CharacterRange).left.value).toBe('a\'\n\t\\');
    });

});

describe('DefaultValueConverter.runConverter', () => {

    // The conversion is chosen by the rule name (INT, STRING, ID, case-insensitive) first,
    // then by the rule type (number, boolean, bigint, Date, case-insensitive), otherwise the input is kept.
    const grammar = `
        grammar Converter
        entry Model: 'model';

        terminal INT returns number: /[0-9]+/;
        terminal STRING: /"[^"]*"/;
        terminal ID: /\\^?[a-z]+/;
        terminal DECIMAL returns number: /[0-9]+\\.[0-9]+/;
        terminal TERMINAL_STRING returns string: /[a-z]+/;

        Int returns number: DECIMAL;
        String returns string: STRING;
        Id returns string: ID;
        Num returns number: DECIMAL;
        Flag returns boolean: 'yes' | 'no' | ID;
        Big returns bigint: INT;
        Day returns Date: STRING;
        Plain returns string: ID;
        Name: ID;
        Number: DECIMAL;
        Boolean: ID;
    `;

    class TestValueConverter extends DefaultValueConverter {
        run(rule: GrammarTypes.AbstractRule, input: string): ValueType {
            return this.runConverter(rule, input, undefined as unknown as CstNode);
        }
    }

    let rules: GrammarTypes.AbstractRule[];

    beforeAll(async () => {
        rules = (await createServicesForGrammar({ grammar })).Grammar.rules;
    });

    function findRule(name: string): GrammarTypes.AbstractRule {
        const rule = rules.find(r => r.name === name);
        expect(rule).toBeDefined();
        return rule!;
    }

    test.each<[rule: string, input: string, expected: ValueType]>([
        // By rule name
        ['INT', '42', 42],
        ['STRING', '"a\\tb"', 'a\tb'],
        ['ID', '^abc', 'abc'],
        // By rule name, case-insensitive. The name takes precedence over the type, e.g. `Int returns number` uses parseInt.
        ['Int', '4.5', 4],
        ['String', '"a\\tb"', 'a\tb'],
        ['Id', '^abc', 'abc'],
        // By rule type
        ['DECIMAL', '4.5', 4.5],
        ['Num', '4.5', 4.5],
        ['Flag', 'TRUE', true],
        ['Flag', 'yes', false],
        ['Big', '12', BigInt(12)],
        ['Day', '2020-01-02', new Date('2020-01-02')],
        // Without explicit type, the rule name is the type, case-insensitive
        ['Number', '4.5', 4.5],
        ['Boolean', 'true', true],
        // No conversion
        ['TERMINAL_STRING', '^abc', '^abc'],
        ['Plain', '^abc', '^abc'],
        ['Name', '^abc', '^abc'],
    ])('%s converts %s', (ruleName, input, expected) => {
        const rule = findRule(ruleName);
        const converter = new TestValueConverter();
        expect(converter.run(rule, input)).toEqual(expected);
        // Repeated conversions for the same rule yield the same result
        expect(converter.run(rule, input)).toEqual(expected);
        expect(new TestValueConverter().run(rule, input)).toEqual(expected);
    });

    test('converts values of different rules independently', () => {
        const converter = new TestValueConverter();
        const results = ['INT', 'Num', 'Flag', 'Plain', 'ID', 'Big'].map(name => converter.run(findRule(name), '1'));
        expect(results).toEqual([1, 1, false, '1', '1', BigInt(1)]);
    });

    test('computes the converter kind once per rule and lets subclasses override it', () => {
        const computed: string[] = [];
        class CountingValueConverter extends TestValueConverter {
            protected override computeConverterKind(rule: GrammarTypes.AbstractRule): ValueConverterKind {
                computed.push(rule.name);
                // treat values of `Plain` as numbers, keep the default for every other rule
                return rule.name === 'Plain' ? 'number' : super.computeConverterKind(rule);
            }
        }
        const converter = new CountingValueConverter();
        expect(converter.run(findRule('Plain'), '4.5')).toBe(4.5);
        expect(converter.run(findRule('Plain'), '1.5')).toBe(1.5);
        expect(converter.run(findRule('Num'), '2.5')).toBe(2.5);
        expect(converter.run(findRule('Num'), '3.5')).toBe(3.5);
        expect(computed).toEqual(['Plain', 'Num']);
    });

});
