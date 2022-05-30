/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, createLangiumGrammarServices, createLangiumParser, Grammar, inject, interpretAstReflection, IParserConfig, LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumParser, LangiumServices, LangiumSharedServices, Module } from '../../src';
import { parseHelper } from '../../src/test';

const grammarServices = createLangiumGrammarServices().grammar;
const helper = parseHelper<Grammar>(grammarServices);

describe('Predicated grammar rules with alternatives', () => {

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
        const grammar = (await helper(content)).parseResult.value;
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

describe('Predicated groups', () => {

    let grammar: Grammar;
    let parser: LangiumParser;
    const content = `
    grammar TestGrammar

    entry Main:
        'simple1' Simple<true, true> |
        'simple2' Simple<false, false> |
        'simple3' Simple<false, true> |
        'nested1' Nested<true, true> |
        'nested2' Nested<true, false> |
        'nested3' Nested<false, true> |
        'optional:false' Optional<false> |
        'optional:true' Optional<true> |
        'plus:false' AtLeastOne<false> |
        'plus:true' AtLeastOne<true> |
        'star:false' Many<false> |
        'star:true' Many<true>
    ;

    Simple<A, B>: (<A> a=ID) (<B> b=ID);
    Nested<A, B>: (<A> a=ID (<B> b=ID));
    Optional<A>: (<A> a=ID)?;
    AtLeastOne<A>: (<A> a+=ID)+;
    Many<A>: (<A> a+=ID)*;

    terminal ID: 'x';
    hidden terminal WS: /\\s+/;
    `;

    beforeAll(async () => {
        grammar = (await helper(content)).parseResult.value;
        parser = parserFromGrammar(grammar);
    });

    function expectCorrectParse(text: string, a: number, b = 0): void {
        const result = parser.parse(text);
        expect(result.parserErrors.length).toBe(0);
        const main = result.value as { a?: string | string[], b?: string | string[] };
        const mainA = typeof main.a === 'string' ? 1 : Array.isArray(main.a) ? main.a.length : 0;
        const mainB = typeof main.b === 'string' ? 1 : Array.isArray(main.b) ? main.b.length : 0;
        expect(mainA).toBe(a);
        expect(mainB).toBe(b);
    }

    function expectErrorneousParse(text: string): void {
        const result = parser.parse(text);
        expect(result.parserErrors.length).toBeGreaterThan(0);
    }

    test('Should parse simple correctly', () => {
        expectCorrectParse('simple1 x x', 1, 1);
        expectErrorneousParse('simple1');
        expectErrorneousParse('simple1 x');
        expectCorrectParse('simple2', 0, 0);
        expectErrorneousParse('simple2 x');
        expectErrorneousParse('simple2 x x');
        expectCorrectParse('simple3 x', 0, 1);
        expectErrorneousParse('simple3');
        expectErrorneousParse('simple3 x x');
    });

    test('Should parse nested correctly', () => {
        expectCorrectParse('nested1 x x', 1, 1);
        expectErrorneousParse('nested1');
        expectErrorneousParse('nested1 x');
        expectCorrectParse('nested2 x', 1, 0);
        expectErrorneousParse('nested2 x x');
        expectCorrectParse('nested3', 0, 0);
        expectErrorneousParse('nested3 x');
        expectErrorneousParse('nested3 x x');
    });

    test('Should parse "optional" correctly', () => {
        expectCorrectParse('optional:false', 0);
        expectErrorneousParse('optional:false x');
        expectCorrectParse('optional:true', 0);
        expectCorrectParse('optional:true x', 1);
    });

    test('Should parse "plus" correctly', () => {
        expectCorrectParse('plus:false', 0);
        expectErrorneousParse('plus:false x');
        expectErrorneousParse('plus:false xxx');
        expectCorrectParse('plus:true xxxx', 4);
        expectErrorneousParse('plus:true');
    });

    test('Should parse "star" correctly', () => {
        expectCorrectParse('star:false', 0);
        expectErrorneousParse('star:false x');
        expectErrorneousParse('star:false xxx');
        expectCorrectParse('star:true xxxx', 4);
        expectCorrectParse('star:true', 0);
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
    hidden terminal WS: /\\s+/;
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

describe('Boolean value converter', () => {
    let parser: LangiumParser;
    const content = `
    grammar G
    entry M: value?='true';
    hidden terminal WS: /\\s+/;
    `;

    beforeAll(async () => {
        const grammar = (await helper(content)).parseResult.value;
        parser = parserFromGrammar(grammar);
    });

    function expectValue(input: string, value: unknown): void {
        const main = parser.parse(input).value as unknown as { value: unknown };
        expect(main.value).toBe(value);
    }

    test('Should have no definition errors', () => {
        expect(parser.definitionErrors).toHaveLength(0);
    });

    test('Parsed Boolean is correct', () => {
        expectValue('true', true);
        // normal behavior when a property type can be resolved to only boolean
        // gives us true/false values representing the parse result
        expectValue('false', false);
        expectValue('something-else-entirely', false);
    });
});

describe('BigInt Parser value converter', () => {
    let parser: LangiumParser;
    const content = `
    grammar G
    entry M: value=BIGINT;
    terminal BIGINT returns bigint: /[0-9]+/;
    hidden terminal WS: /\\s+/;
    `;

    beforeAll(async () => {
        const grammar = (await helper(content)).parseResult.value;
        parser = parserFromGrammar(grammar);
    });

    function expectValue(input: string, value: unknown): void {
        const main = parser.parse(input).value as unknown as { value: unknown };
        expect(main.value).toBe(value);
    }

    test('Should have no definition errors', () => {
        expect(parser.definitionErrors).toHaveLength(0);
    });

    test('Parsed BigInt is correct', () => {
        expectValue('149587349587234971', BigInt('149587349587234971'));
        expectValue('9007199254740991', BigInt('9007199254740991')); // === 0x1fffffffffffff
    });
});

describe('Date Parser value converter', () => {
    let parser: LangiumParser;
    const content = `
    grammar G
    entry M: value=DATE;
    terminal DATE returns Date: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/;
    hidden terminal WS: /\\s+/;
    `;

    beforeAll(async () => {
        const grammar = (await helper(content)).parseResult.value;
        parser = parserFromGrammar(grammar);
    });

    test('Should have no definition errors', () => {
        expect(parser.definitionErrors).toHaveLength(0);
    });

    test('Parsed Date is correct Date object', () => {
        const parseResult = parser.parse('2022-10-12T00:00').value as unknown as { value: unknown };
        expect(parseResult.value).toEqual(new Date('2022-10-12T00:00'));
    });
});

describe('Parser calls value converter', () => {

    let parser: LangiumParser;
    const content = `
    grammar TestGrammar
    entry Main:
        'big' BigVal |
        'b' value?='true' |
        'q' value=QFN |
        'n' value=Number |
        'd' value=DATE;

    QFN returns string: ID ('.' QFN)?;
    terminal ID: /\\^?[_a-zA-Z][\\w_]*/;

    fragment BigVal: value=BINT 'n';
    terminal BINT returns bigint: INT /(?=n)/;

    terminal DATE returns Date: /[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2})?/;

    Number returns number:
        INT ('.' INT)?;
    terminal INT returns number: /[0-9]+/;

    hidden terminal WS: /\\s+/;
    hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
    `;

    beforeAll(async () => {
        const grammar = (await helper(content)).parseResult.value;
        parser = parserFromGrammar(grammar);
    });

    function expectValue(input: string, value: unknown): void {
        const main = parser.parse(input).value as unknown as { value: unknown };
        expect(main.value).toBe(value);
    }

    function expectEqual(input: string, value: unknown): void {
        const main = parser.parse(input).value as unknown as { value: unknown };
        expect(main.value).toEqual(value);
    }

    test('Should have no definition errors', () => {
        expect(parser.definitionErrors).toHaveLength(0);
    });

    test('Should parse ID inside of data type rule correctly', () => {
        expectValue('q ^x', 'x');
    });

    test('Should parse FQN correctly', () => {
        expectValue('q ^x.y.^z', 'x.y.z');
    });

    test('Should parse FQN with whitespace correctly', () => {
        expectValue('q ^x. y . ^z', 'x.y.z');
    });

    test('Should parse FQN with comment correctly', () => {
        expectValue('q ^x./* test */y.^z', 'x.y.z');
    });

    test('Should parse integer correctly', () => {
        expectValue('n 123', 123);
    });

    test('Should parse float correctly', () => {
        expectValue('n 123.5', 123.5);
    });

    test('Should parse bool correctly', () => {
        expectValue('b true', true);
        // this is the current 'boolean' behavior when a prop type can't be resolved to just a boolean
        // either true/undefined, no false in this case
        expectValue('b false', undefined);
        // ...then no distinguishing between the bad parse case when the type is unclear
        expectValue('b asdfg', undefined);
    });

    test('Should parse BigInt correctly', () => {
        expectValue('big 9007199254740991n', BigInt('9007199254740991'));
        expectValue('big 9007199254740991', undefined);
        expectValue('big 1.1', undefined);
        expectValue('big -19458438592374', undefined);
    });

    test('Should parse Date correctly', () => {
        expectEqual('d 2020-01-01', new Date('2020-01-01'));
        expectEqual('d 2020-01-01T00:00', new Date('2020-01-01T00:00'));
        expectEqual('d 2022-10-04T12:13', new Date('2022-10-04T12:13'));
        expectEqual('d 2022-Peach', undefined);
    });
});

function parserFromGrammar(grammar: Grammar): LangiumParser {
    const parserConfig: IParserConfig = {
        skipValidations: false
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unavailable: () => any = () => ({});
    const generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
        AstReflection: () => interpretAstReflection(grammar),
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
