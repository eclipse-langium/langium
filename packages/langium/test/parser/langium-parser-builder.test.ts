/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { TokenType, TokenVocabulary } from 'chevrotain';
import type { AstNode, CstNode, GenericAstNode, Grammar, GrammarAST, LangiumParser, ParseResult, TokenBuilderOptions } from 'langium';
import { EmptyFileSystem, DefaultTokenBuilder, GrammarUtils } from 'langium';
import { describe, expect, test, onTestFailed, beforeAll } from 'vitest';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import { expandToString } from 'langium/generate';
import { parseHelper } from 'langium/test';
import { EOF } from 'chevrotain';

describe('Predicated grammar rules with alternatives', () => {

    const content = `
    grammar TestGrammar

    entry Main: RuleA | RuleB | RuleC | RuleD | RuleE | RuleF | RuleG;

    RuleA: 'a' TestSimple<true, true>;
    RuleB: 'b' TestSimple<false, true>;
    RuleC: 'c' TestSimple<true, false>;
    RuleD: 'd' TestSimple<false, false>;
    RuleE: 'e' TestComplex<true, true, true>;
    RuleF: 'f' TestComplex<false, false, true>;
    RuleG: 'g' TestComplex<true, false, true>;

    TestSimple<A, B>: <A & B> a=ID | <B & !A> b=ID | <A & !B> c=ID | <!A & !B> d=ID;
    TestComplex<A, B, C>: <A & B & C> e=ID | <(B | C) & !A> f=ID | <(A | (C & false)) & !B> g=ID;

    terminal ID: '1';
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
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

    for (const letter of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        const current = letter;
        test(`Should parse Rule${current.toUpperCase()} correctly`, () => {
            hasProp(current);
        });
    }
});

describe('Predicated groups', () => {

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

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
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

describe('Handle unordered group', () => {

    const content = `
    grammar TestUnorderedGroup

    entry Lib:
	    books+=Book*;

    Book:
        'book' name=STRING
        (
              ("description" descr=STRING)
            & ("edition" version=STRING)
            & ("author" author=STRING)
        )
    ;
    hidden terminal WS: /\\s+/;
    terminal STRING: /"[^"]*"|'[^']*'/;
    `;

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
    });

    test('Should parse documents without Errors', () => {
        type bookType = { version?: string, author?: string, descr?: string }
        // declared order
        let parsedNode = parseAndCheck(
            `
            book "MyBook"

            description "Cool book"
            edition "second"
            author "me"
            `, parser) as { books?: string | string[] };
        expect(parsedNode?.books).toBeDefined();

        let book: bookType = parsedNode?.books![0] as bookType;
        expect(book.version).toBe('second');
        expect(book.descr).toBe('Cool book');
        expect(book.author).toBe('me');

        parsedNode = parseAndCheck(
            `
            book "MyBook"

            edition "second"
            description "Cool book"
            author "me"
            `, parser) as { books?: string | string[] };
        expect(parsedNode?.books).toBeDefined();

        // swapped order
        book = parsedNode?.books![0] as bookType;
        expect(book.version).toBe('second');
        expect(book.author).toBe('me');
        expect(book.descr).toBe('Cool book');
    });

    test('Should not parse documents with duplicates', () => {
        // duplicate description
        const parsed = parser!.parse<AstNode>(
            `book "MyBook"

            edition "second"
            description "Cool book"
            description "New description"
            author "foo"
            `);
        expect(parsed.parserErrors.length).toBe(2);
    });

    test('Should parse multiple instances', () => {
        // duplicate description
        const lib = (parseAndCheck(
            `
            book "MyBook"

            edition "second"
            description "Cool book"
            author "foo"

            book "MyBook2"

            edition "second2"
            description "Cool book2"
            author "foo2"

            `, parser) as { parserErrors?: string | string[], books?: string[] });
        expect(lib.parserErrors).toBeUndefined();
        expect(lib.books).not.toBeUndefined();
        expect(lib.books?.length).toBe(2);
    });

});

function parseAndCheck(model: string, parser: LangiumParser): AstNode {
    const result = parser!.parse<AstNode>(model);
    expect(result.lexerErrors.length).toBe(0);
    expect(result.parserErrors.length).toBe(0);
    expect(result.value).not.toBeUndefined();
    return result.value;
}

describe('One name for terminal and non-terminal rules', () => {
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

    test('Should work without Parser Definition Errors', async () => {
        await parserFromGrammar(content).catch(e => onTestFailed(e));
    });

});

describe('check the default value converter for data type rules using terminal rules', () => {
    const grammar = `
    grammar Test

    entry Main:
        propInteger=INT_value
        propBoolean=BOOLEAN_value
        propString=STRING_value;

    INT_value returns number: MY_INT;
    BOOLEAN_value returns boolean: MY_BOOLEAN;
    STRING_value returns string: MY_ID;

    terminal MY_INT returns number: /((-|\\+)?[0-9]+)/;
    terminal MY_BOOLEAN returns string: /(true)|(false)/;
    terminal MY_ID returns string: /[a-zA-Z]+/;

    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;
    beforeAll(async () => {
        parser = await parserFromGrammar(grammar);
    });

    test('Should have no definition errors', () => {
        expect(parser.definitionErrors).toHaveLength(0);
    });

    test('string vs number', async () => {
        const result = parser.parse('123 true abc');
        expect(result.lexerErrors.length).toBe(0);
        expect(result.parserErrors.length).toBe(0);
        const value = result.value as unknown as { propInteger: number, propBoolean: boolean, propString: string };
        expect(value.propInteger).not.toBe('123');
        expect(value.propInteger).toBe(123);
        expect(value.propBoolean).toBe(true);
        expect(value.propString).toBe('abc');
    });
});

describe('Boolean value converter', () => {
    const content = `
    grammar G
    entry M: value?='true';
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
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
    const content = `
    grammar G
    entry M: value=BIGINT?;
    terminal BIGINT returns bigint: /[0-9]+/;
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
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

    test('Missing value is implicitly undefined', () => {
        expectValue('', undefined);
    });
});

describe('Date Parser value converter', () => {
    const content = `
    grammar G
    entry M: value=DATE;
    terminal DATE returns Date: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/;
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
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

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
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
        expectValue('b false', false);
        // Any value that cannot be parsed correctly is automatically false
        expectValue('b asdfg', false);
    });

    test('Should parse BigInt correctly', () => {
        expectValue('big 9007199254740991n', BigInt('9007199254740991'));
        // Any value that cannot be parsed correctly is automatically false
        expectValue('big 9007199254740991', false);
        expectValue('big 1.1', false);
        expectValue('big -19458438592374', false);
    });

    test('Should parse Date correctly', () => {
        expectEqual('d 2020-01-01', new Date('2020-01-01'));
        expectEqual('d 2020-01-01T00:00', new Date('2020-01-01T00:00'));
        expectEqual('d 2022-10-04T12:13', new Date('2022-10-04T12:13'));
        // Any value that cannot be parsed correctly is automatically false
        expectEqual('d 2022-Peach', false);
    });

    test('Enums are correctly parsed with types', async () => {
        const parser = await parserFromGrammar(`
            grammar Test

            entry Main:
                value=Enum;

            Enum returns Enum: 'A' | 'B' | 'C';
            type Enum: 'A' | 'B' | 'C';

            hidden terminal WS: /\\s+/;
        `);

        const result = parser.parse('A');
        expect(result.lexerErrors.length).toBe(0);
        expect(result.parserErrors.length).toBe(0);
        const value = result.value as unknown as { value: string };
        expect(value.value).toBeTypeOf('string');
        expect(value.value).toBe('A');
    });

    test('Enums are correctly parsed without types', async () => {
        const parser = await parserFromGrammar(`
            grammar Test

            entry Main:
                value=Enum;

            Enum returns string: 'A' | 'B' | 'C';

            hidden terminal WS: /\\s+/;
        `);

        const result = parser.parse('A');
        expect(result.lexerErrors.length).toBe(0);
        expect(result.parserErrors.length).toBe(0);
        const value = result.value as unknown as { value: string };
        expect(value.value).toBeTypeOf('string');
        expect(value.value).toBe('A');
    });
});

// Constructs a grammar w/ a special token-builder to support multi-mode lexing
describe('MultiMode Lexing', () => {

    // Multi-mode token builder, filters tokens by state, and sets up push/pop behavior
    // Without this, we have no multi-mode lexing from the grammar alone
    class MultiModeTokenBuilder extends DefaultTokenBuilder {
        override buildTokens(grammar: Grammar, options?: TokenBuilderOptions): TokenVocabulary {
            const tokenTypes: TokenType[] = super.buildTokens(grammar, options) as TokenType[];
            return {
                modes: {
                    up: tokenTypes.filter(token => !['LowStr'].includes(token.name)),
                    down: tokenTypes.filter(token => !['UpStr'].includes(token.name))
                },
                defaultMode: 'down'
            };
        }

        protected override buildTerminalToken(terminal: GrammarAST.TerminalRule): TokenType {
            const tokenType = super.buildTerminalToken(terminal);
            if (tokenType.name === 'Up') {
                tokenType.PUSH_MODE = 'up';
            } else if (tokenType.name === 'Low') {
                tokenType.PUSH_MODE = 'down';
            } else if (tokenType.name === 'Pop') {
                tokenType.POP_MODE = true;
            }
            return tokenType;
        }
    }

    /* Demonstrational MultiMode grammar
       Describes words that are either all 'lower' or 'UPPER' case, no mixing

       ++ pushes upper case mode to stack
       -- pushes lower case mode to stack
       ## pops current mode from stack
    */
    const grammar = `
    grammar MultiMode

    entry Sentence: words+=Word*;

    Word: value=(Up | Low | LowStr | UpStr | Pop);

    // push up state
    terminal Up returns string: '++';

    // push low state
    terminal Low returns string: '--';

    // pop last state
    terminal Pop returns string: '##';

    terminal LowStr returns string: /[a-z]+/;
    terminal UpStr returns string: /[A-Z]+/;

    hidden terminal WS: /\\s+/;`;

    let parser: LangiumParser;

    beforeAll(async () => {
        const services = await createServicesForGrammar({
            grammar,
            module: {
                parser: {
                    TokenBuilder: () => new MultiModeTokenBuilder()
                }
            }
        });
        parser = services.parser.LangiumParser;
    });

    test('multimode lexing works in default mode as expected', () => {
        const result = parser.parse('apple banana cherry');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

    test('multimode lexing pushes mode correctly', () => {
        const result = parser.parse('apple banana cherry ++ APPLE BANANA CHERRY');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

    test('multimode lexing does not use tokens from non-starting mode', () => {
        // default should be lowercase only
        const result = parser.parse('APPLE');
        expect(result.lexerErrors).toHaveLength(1);
    });

    test('multimode blocks preceding tokens from different mode', () => {
        // default should be lowercase only
        const result = parser.parse('apple APPLE');
        expect(result.lexerErrors).toHaveLength(1);
    });

    test('multimode lexing fails on bad tokens after lex mode change', () => {
        const result = parser.parse('apple banana cherry ++ apple');
        expect(result.lexerErrors).toHaveLength(1);
    });

    test('multimode lexing pushes multiple modes correctly', () => {
        const result = parser.parse('apple ++ BANANA -- cherry ++ APPLE');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

    test('multimode lexing pops states correctly', () => {
        const result = parser.parse('apple ++ BANANA -- cherry ## APPLE ## banana');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

    test('multimode lexing fails on pop with empty state stack', () => {
        const result = parser.parse('apple ## oops');
        expect(result.lexerErrors).toHaveLength(1);
    });

    test('multimode lexing can start with mode push', () => {
        const result = parser.parse('++ APPLE');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

    test('multimode lexing can end with mode pop', () => {
        const result = parser.parse('++ APPLE ##');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

    test('multimode lexing can repeatedly push same state', () => {
        const result = parser.parse('++ APPLE ++ BANANA ++ PEAR');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
    });

});

describe('Fragment rules', () => {

    test('Fragment rules with arrays are correctly assigned to property', async () => {
        const parser = await parserFromGrammar(`
        grammar FragmentRuleArrays
        entry Entry: Fragment*;
        fragment Fragment: values+=ID;
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;

        hidden terminal WS: /\\s+/;
        `);
        const result = parser.parse('ab cd ef');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
        expect(result.value).toHaveProperty('values', ['ab', 'cd', 'ef']);
    });

});

describe('Unicode terminal rules', () => {

    const grammar = `
    grammar test
    entry Model: value=UnicodeID;
    terminal UnicodeID returns string: /\\p{L}(\\p{L}|\\p{N})*/u;
    hidden terminal WS: /\\s+/;
    `;
    const parser = parserFromGrammar(grammar);

    for (const value of ['John', 'Jörg', 'José', '佐藤', '李']) {
        test(`Parses ${value} using unicode terminal`, () => {
            return expectParse(value);
        });
    }

    async function expectParse(value: string): Promise<void> {
        const result = (await parser).parse(value);
        expect(result.value).toHaveProperty('value', value);
    }

});

describe('Parsing default values', () => {

    const grammar = `
        grammar test
        entry Model returns Model: a=ID b="world"? (c+=ID)*;

        interface Model {
            a: string
            b: string = "hello"
            c: string[] = ["a", "b", "c"]
        }

        terminal ID: /\\w+/;
        hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(grammar);
    });

    test('Assigns default values for properties', async () => {
        const result = parser.parse('hi');
        const model = result.value as unknown as {
            a: string
            b: string
            c: string[]
        };
        expect(model.a).toBe('hi');
        expect(model.b).toBe('hello');
        expect(model.c).toEqual(['a', 'b', 'c']);
    });

    test('Does not overwrite parsed value for "b"', async () => {
        const result = parser.parse('hi world');
        const model = result.value as unknown as {
            a: string
            b: string
            c: string[]
        };
        expect(model.a).toBe('hi');
        expect(model.b).toBe('world');
    });

    test('Does not overwrite parsed value for "c"', async () => {
        const result = parser.parse('hi world d e');
        const model = result.value as unknown as {
            a: string
            b: string
            c: string[]
        };
        expect(model.c).toEqual(['d', 'e']);
    });

});

describe('ALL(*) parser', () => {

    const grammar = `
    grammar UnboundedLookahead

    entry Entry: A | B;

    // Potentially unlimited amount of 'a' tokens
    A: {infer A} 'a'* 'b';
    B: {infer B} 'a'* 'c';

    hidden terminal WS: /\\s+/;`;

    test('can parse with unbounded lookahead #1', async () => {
        const parser = await parserFromGrammar(grammar);
        const result = parser.parse('aaaaaaaaaab');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
        expect(result.value.$type).toBe('A');
    });

    test('can parse with unbounded lookahead #2', async () => {
        const parser = await parserFromGrammar(grammar);
        const result = parser.parse('aaaaaaaaaaaaaac');
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
        expect(result.value.$type).toBe('B');
    });
});

describe('Parsing actions', () => {

    test('Using normal action preserves object fields', async () => {
        const grammar = `
        grammar Test
        entry A: a='a' ({infer B} b='b');
        hidden terminal WS: /\\s+/;
        `;
        const services = await createServicesForGrammar({ grammar });
        const parseResult = services.parser.LangiumParser.parse('a b').value as GenericAstNode;
        expect(parseResult.$type).toBe('B');
        expect(parseResult).toHaveProperty('a', 'a');
        expect(parseResult).toHaveProperty('b', 'b');
    });

    test('Yield correct CST with previous assignment', async () => {
        await testCorrectAssignedActions(`
            grammar Test
            entry Main: value=A;
            A: a='a' ({infer B.previous=current} b='b')*;
            hidden terminal WS: /\\s+/;
        `);
    });

    test('Yield correct CST with previous unassigned rulecall', async () => {
        await testCorrectAssignedActions(`
            grammar Test
            entry Main: value=Item;
            Item: A ({infer B.previous=current} b='b')*;
            A: a='a';
            hidden terminal WS: /\\s+/;
        `);
    });

    async function testCorrectAssignedActions(grammar: string): Promise<void> {
        const services = await createServicesForGrammar({ grammar });
        const parseResult = services.parser.LangiumParser.parse('a b b b').value as GenericAstNode;
        const value = parseResult.value as GenericAstNode;
        expect(value.$type).toBe('B');
        expect(value.$cstNode).toBeDefined();
        expect(value.$cstNode!.text).toBe('a b b b');
        const previous1 = value.previous as GenericAstNode;
        expect(previous1.$type).toBe('B');
        expect(previous1.$cstNode).toBeDefined();
        expect(previous1.$cstNode!.text).toBe('a b b');
        const previous2 = previous1.previous as GenericAstNode;
        expect(previous2.$type).toBe('B');
        expect(previous2.$cstNode).toBeDefined();
        expect(previous2.$cstNode!.text).toBe('a b');
        const previous3 = previous2.previous as GenericAstNode;
        expect(previous3.$type).toBe('A');
        expect(previous3.$cstNode).toBeDefined();
        expect(previous3.$cstNode!.text).toBe('a');
    }
});

describe('Unassigned subrules', () => {
    const content = `
        grammar SubrulesCST
        entry Entry: X;
        X: Visibility? (A | B) Body;
        fragment Visibility: visibility=('public' | 'protected' | 'private');
        fragment Body: '{' (children+=X)* '}';
        A: 'A' value1=INT (C | D)?;
        B: 'B' value1=INT (C | D)?;
        C: 'C' value2=INT;
        D: 'D' value2=INT;
        
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        terminal INT returns number: /\\d+/;
        hidden terminal WS: /\\s+/;
    `;
    let parser: LangiumParser;

    beforeAll(async () => {
        parser = await parserFromGrammar(content);
    });

    const testProps = (text: string, ...props: string[]): void => {
        const result = parser.parse(text);
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);

        const cst = result.value.$cstNode;
        const element = cst?.astNode;
        expect(element).toBeDefined();
        expect(element).toBe(result.value);
        props.forEach(prop => {
            const propCst = GrammarUtils.findNodeForProperty(cst, prop);
            expect(propCst).toBeDefined();
            expect(element).toBe(propCst?.astNode);
        });
    };

    test('CST prior to the subrule contains valid AST element', () => {
        testProps('public A 100 {}', 'visibility');
    });

    test('Subrule CST contains valid AST element', async () => {
        testProps('public A 100 {}', 'value1');
    });

    test('Nested subrule CST contains valid AST element', async () => {
        testProps('public A 100 C 100 {}', 'value1', 'value2');
    });

});

describe('Handling EOF', () => {
    test('Use EOF as last part of the entry rule definition', async () => {
        const grammar = `
        grammar Test
        entry Main: greet='Hello!' EOF;
        hidden terminal WS: /\\s+/;
        `;
        const services = createLangiumGrammarServices(EmptyFileSystem);
        const output = await parseHelper(services.grammar)(grammar, { validation: true });
        expect(output.parseResult.lexerErrors.length).toBe(0);
        expect(output.parseResult.parserErrors.length).toBe(0);
        expect(output.diagnostics?.length ?? 0).toBe(0);
    });

    test('Use EOF as a line break', async () => {
        const grammar = `
        grammar Test
        entry Lines: lines+=Line*;
        Line: text=ID (EOL | EOF);
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal EOL: /\\r?\\n/;
        `;
        const langiumServices = createLangiumGrammarServices(EmptyFileSystem);
        const output = await parseHelper(langiumServices.grammar)(grammar, { validation: true });
        expect(output.parseResult.lexerErrors.length).toBe(0);
        expect(output.parseResult.parserErrors.length).toBe(0);
        expect(output.diagnostics?.length ?? 0).toBe(0);

        const grammarServices = await createServicesForGrammar({ grammar });
        const parse = parseHelper(grammarServices);
        const document = await parse('First\nMiddle\nLast', { validation: true });
        expect(document.parseResult.lexerErrors.length).toBe(0);
        expect(document.parseResult.parserErrors.length).toBe(0);
        expect(document.diagnostics?.length ?? 0).toBe(0);
    });

    test('Use EOF in an invalid position', async () => {
        const grammar = `
        grammar Test
        entry Main: greet='Hello!' EOF name='user!';
        hidden terminal WS: /\\s+/;
        `;
        const services = await createServicesForGrammar({ grammar });
        const parse = parseHelper(services);

        const document = await parse('Hello!user!', { validation: true });
        expect(document.parseResult.parserErrors.length).toBe(1);
        expect(document.parseResult.parserErrors[0].name).toBe('MismatchedTokenException');
        expect(document.parseResult.parserErrors[0].token.tokenType.name).toBe('user!');

        const second = await parse('Hello!', { validation: true });
        expect(second.parseResult.parserErrors.length).toBe(1);
        expect(second.parseResult.parserErrors[0].name).toBe('MismatchedTokenException');
        expect(second.parseResult.parserErrors[0].token.tokenType).toBe(EOF);
    });

    [
        `
        grammar Test
        entry Main: greet='Hello!' EOF;
        hidden terminal WS: /\\s+/;
        `,
        `
        grammar Test
        entry Main: Test;
        fragment Test: greet='Hello!' EOF;
        hidden terminal WS: /\\s+/;
        `
    ].forEach((grammar, i) => {
        test('Using EOF does not result in invalid AST/CST #' + i, async () => {
            const parser = await parserFromGrammar(grammar);
            const output = parser.parse('Hello!');
            const value = output.value as GenericAstNode;
            expect(value.greet).toBe('Hello!');
            const cst = output.value.$cstNode!;
            expectValidCstNode(cst);
        });
    });

    function expectValidCstNode(cst: CstNode): void {
        expect(cst).toBeDefined();
        expect(cst.offset).not.toBeNaN();
        expect(cst.end).not.toBeNaN();
        expect(cst.end).toBeGreaterThan(cst.offset);
        expect(cst.range.start.line).not.toBeNaN();
        expect(cst.range.start.character).not.toBeNaN();
        expect(cst.range.end.line).not.toBeNaN();
        expect(cst.range.end.character).not.toBeNaN();
    }
});

describe('Unassigned data type rules', () => {

    test('Can successfully parse unassigned data type rule in parser rule', async () => {
        const parser = await parserFromGrammar(expandToString`
            grammar HelloWorld

            entry Model:
                ((persons+=Person) EOL)*;

            Person:
                'person' name=ID;

            hidden terminal WS: /[ \\t]+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            terminal NEWLINE: /\\r?\\n/;
            EOL returns string:
                NEWLINE | EOF;`
        );
        const parseResult = parser.parse(expandToString`
            person John
            person Jane
        `);
        expect(parseResult.lexerErrors).toHaveLength(0);
        expect(parseResult.parserErrors).toHaveLength(0);
    });
});

describe('Parsing with lookbehind tokens', () => {
    test('Parser Success / Failure with positive lookbehind', async () => {
        await testLookbehind(true, 'AB', 'CB');
    });

    test('Parser Success / Failure with negative lookbehind', async () => {
        await testLookbehind(false, 'CB', 'AB');
    });

    async function testLookbehind(positive: boolean, success: string, failure: string): Promise<void> {
        const parser = await parserFromGrammar(`
            grammar test
            entry Main: ('A' | 'C') b=B;
            terminal B: (?<${positive ? '=' : '!'}'A')'B';
            hidden terminal WS: /\\s+/;
            `
        );
        const validResult = parser.parse(success) as ParseResult<GenericAstNode>;
        expect(validResult.value.b).toEqual('B');
        const invalidResult = parser.parse(failure);
        expect(invalidResult.lexerErrors).toHaveLength(1);
        expect(invalidResult.parserErrors).toHaveLength(1);
    }
});

async function parserFromGrammar(grammar: string): Promise<LangiumParser> {
    return (await createServicesForGrammar({ grammar })).parser.LangiumParser;
}
