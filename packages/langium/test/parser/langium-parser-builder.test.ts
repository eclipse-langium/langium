/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TokenType, TokenVocabulary } from 'chevrotain';
import { AstNode, createServicesForGrammar, DefaultTokenBuilder, Grammar, GrammarAST, LangiumParser, TokenBuilderOptions } from '../../src';

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

    beforeEach(async () => {
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

    beforeEach(async () => {
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

    beforeEach(async () => {
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
        await parserFromGrammar(content).catch(e => fail(e));
    });

});

describe('Boolean value converter', () => {
    const content = `
    grammar G
    entry M: value?='true';
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeEach(async () => {
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
    entry M: value=BIGINT;
    terminal BIGINT returns bigint: /[0-9]+/;
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeEach(async () => {
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
});

describe('Date Parser value converter', () => {
    const content = `
    grammar G
    entry M: value=DATE;
    terminal DATE returns Date: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/;
    hidden terminal WS: /\\s+/;
    `;

    let parser: LangiumParser;

    beforeEach(async () => {
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

    beforeEach(async () => {
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
            if(tokenType.name === 'Up') {
                tokenType.PUSH_MODE = 'up';
            } else if(tokenType.name === 'Low') {
                tokenType.PUSH_MODE = 'down';
            } else if(tokenType.name === 'Pop') {
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

    beforeEach(async () => {
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

async function parserFromGrammar(grammar: string): Promise<LangiumParser> {
    return (await createServicesForGrammar({ grammar })).parser.LangiumParser;
}
