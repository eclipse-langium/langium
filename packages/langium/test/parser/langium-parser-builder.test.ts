/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, createLangiumGrammarServices, createLangiumParser, Grammar, inject, IParserConfig, LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumParser, LangiumServices, LangiumSharedServices, Module } from '../../src';
import { parseHelper } from '../../src/test';

const grammarServices = createLangiumGrammarServices().grammar;
const helper = parseHelper<Grammar>(grammarServices);

describe('Predicated grammar rules', () => {

    let grammar: Grammar;
    let parser: LangiumParser;
    const content = `
    grammar TestGrammar

    entry Main: RuleA | RuleB | RuleC | RuleD | RuleE | RuleF | RuleG;

    RuleA: 'a' TestSimple<true, true>;
    RuleB: 'b' TestSimple<false, true>;
    RuleC: 'c' TestSimple<true, false>;
    RuleD: 'd' TestSimple<false, false>;
    RuleE: 'e' TestComplex<true, true, true>;
    RuleF: 'f' TestComplex<true, false, true>;
    RuleG: 'g' TestComplex<false, true, false>;

    TestSimple<A, B>: <A & B> a=ID | <B> b=ID | <A> c=ID | <!A> d=ID;
    TestComplex<A, B, C>: <A & B & C> e=ID | <(B | C) & A> f=ID | <A | (C & false) | B> g=ID;

    terminal ID: '1';
    hidden terminal WS: /\\s+/;
    `;

    beforeAll(async () => {
        grammar = (await helper(content)).parseResult.value;
        parser = parserFromGrammar(grammar);
    });

    function hasProp(prop: string): void {
        const main = parser.parse(prop + '1').value;
        expect(main).toHaveProperty(prop);
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(property => {
            if (property !== prop) {
                expect(main).not.toHaveProperty(property);
            }
        });
    }

    test('Should parse RuleA correctly', () => {
        hasProp('a');
    });

    test('Should parse RuleB correctly', () => {
        hasProp('b');
    });

    test('Should parse RuleC correctly', () => {
        hasProp('c');
    });

    test('Should parse RuleD correctly', () => {
        hasProp('d');
    });

    test('Should parse RuleE correctly', () => {
        hasProp('e');
    });

    test('Should parse RuleF correctly', () => {
        hasProp('f');
    });

    test('Should parse RuleG correctly', () => {
        hasProp('g');
    });

});

describe('One name for terminal and non-terminal rules', () => {
    let grammar: Grammar;
    const content = `
    grammar Test

    entry Main: A | B | C;
    
    A: 'A' Bdata Cterm prop=B;
    
    B: Bdata Cterm 'A' prop=C;
    Bdata returns string: 'B';
    
    C: Cterm 'A' Bdata prop=A;
    terminal Cterm: /C/;    
    `;

    beforeAll(async () => {
        grammar = (await helper(content)).parseResult.value;
    });

    test('Should work without Parser Definition Errors', () => {
        expect(() => {
            parserFromGrammar(grammar);
        }).not.toThrow();
    });

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
