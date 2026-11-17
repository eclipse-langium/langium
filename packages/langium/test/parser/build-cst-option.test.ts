/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, CstNode, GrammarAST, LangiumCoreServices, LangiumParser, ParseResult, ParserOptions, ReferenceInfo, ValueConverter, ValueType } from 'langium';
import { AstUtils, DefaultValueConverter, EmptyFileSystem, isCompositeCstNode, isLeafCstNode, isMultiReference, isReference, URI } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';

/*
 * `LangiumParser.parse(text, { buildCst: false })` must produce exactly the AST, lexer errors and parser
 * errors of a normal parse, only without CST nodes -- including during error recovery.
 */

// Value conversion: every built-in conversion, through a terminal (converted in `consume`) and through a
// datatype rule (converted in `construct`), plus cross-references through a terminal and a datatype rule.
const valuesGrammar = `
grammar Values
entry Model: (elements+=Element | refs+=Ref | Group)*;
Element: 'element' name=ID ('ext' ext=FQN)? ('int' int=INT)? ('str' str=STRING)? ('dec' dec=DECIMAL)?
    (flag?='flag')? ('date' date=DATE)? ('big' big=BIG 'n')? ('kw' kw=('first' | 'second'))?
    ('num' num=NumberDT)? ('bool' bool=BoolDT)? ('bigdt' bigdt=BigDT)? ('datedt' datedt=DateDT)?;
Ref: 'ref' single=[Element:ID] ('qualified' qualified=[Element:QualifiedName])? ('multi' multi=[+Element:ID])?;
fragment Group: 'group' '{' (elements+=Element)* '}';
QualifiedName returns string: ID ('.' ID)*;
FQN returns string: QualifiedName ('::' QualifiedName)?;
NumberDT returns number: '-'? (INT | DECIMAL);
BoolDT returns boolean: 'true' | 'false';
BigDT returns bigint: INT;
DateDT returns Date: STRING;
terminal DATE returns Date: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/;
terminal DECIMAL returns number: /[0-9]+\\.[0-9]+/;
terminal BIG returns bigint: /[0-9]+(?=n)/;
terminal INT returns number: /[0-9]+/;
terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
terminal STRING: /"(\\\\.|[^"\\\\])*"|'(\\\\.|[^'\\\\])*'/;
hidden terminal WS: /\\s+/;
hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
`;

const valuesInputs = [
    '',
    'element a',
    `element ^a ext x.y.z::u.v int 42 str "s\\t\\"q\\"" dec 3.25 flag date 2022-10-12T00:00 big 149587349587234971n kw second
     num -1.5 bool true bigdt 12345 datedt "2022-10-12T00:00"
     ref a qualified x.y multi a`,
    '// comment\nelement a /* inline */ int 1 element b ext q /* trailing */',
    'group { element a element b int 2 } ref a ref b multi a',
    'element a num 1 bool false element b num -2 bool true',
    'ref missing qualified also.missing',
    'element a int',
    'element a ext x. int 1',
    'element ext a',
    'element a num - bool',
    'element a datedt',
    'ref',
    'group { element a',
    'element a big 12 n',
];

// Assigned actions, optional and empty subrules, fragments, unassigned rule calls
const expressionGrammar = `
grammar Expressions
entry Model: (statements+=Statement)*;
Statement: Definition | Evaluation | Block;
Definition: 'def' modifiers=Modifiers name=ID Params? ':' expr=Expression ';';
Modifiers: {infer Modifiers} (static?='static')? (final?='final')?;
fragment Params: '(' (params+=Param (',' params+=Param)*)? ')';
Param: name=ID;
Evaluation: 'eval' expr=Expression? ';';
Block: '{' {infer Block} statements+=Statement* '}';
Expression: Addition;
Addition infers Expression: Multiplication ({infer BinaryExpression.left=current} operator=('+' | '-') right=Multiplication)*;
Multiplication infers Expression: Unary ({infer BinaryExpression.left=current} operator=('*' | '/') right=Unary)*;
Unary infers Expression: {infer UnaryExpression} operator='-' operand=Unary | Primary;
Primary infers Expression: '(' Expression ')' | {infer NumberLiteral} value=NUMBER
    | {infer Call} func=[Definition:ID] ('(' (args+=Expression (',' args+=Expression)*)? ')')?;
terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
terminal ID: /[_a-zA-Z][\\w_]*/;
hidden terminal WS: /\\s+/;
hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
`;

const expressionInputs = [
    'def f(a, b): a + b * 2; eval f(1, 2);',
    'def static final g: -(1 + 2) * 3 - 4 / 5; eval g;',
    '{ def h(): 1; { eval h(); } }',
    'eval /* c */ 1 + /* d */ 2;',
    'eval;',
    'def f(: 1;',
    'def f() 1;',
    'def static : 1;',
    // An assigned action following an operand that consumed no valid token: with a CST, the subrule's
    // composite node only sees the tokens consumed before the action, so recovery drops the assignment.
    'eval + 3;',
    'eval * 3;',
    'eval ( + 3);',
    'eval )+ 3;',
    'eval + 3 + 4;',
    'eval - - ;',
    'eval 1 + ;',
    'eval f(1 +, 2);',
    '{ eval 1 + 2',
    'def f: 1 eval 2;',
];

const infixGrammar = `
grammar Infix
entry Model: (exprs+=Expr ';')*;
Expr: BinaryExpr;
infix BinaryExpr on PrimaryExpr:
    '*' | '/'
    > '+' | '-'
    > right assoc '=' | '*=' | '/=' | '+=' | '-=';
PrimaryExpr: '(' expr=Expr ')' | value=Number | ref=ID;
terminal Number returns number: /[0-9]+/;
terminal ID: /[_a-zA-Z][\\w_]*/;
hidden terminal WS: /\\s+/;
`;

const infixInputs = [
    '1;',
    'a = b += 1 + 2 * 3 - 4 / (5 + c);',
    '1 + ;',
    '+ 1;',
    '(1 + 2;',
    '1 * * 2; 3;',
];

/** Deterministic pseudo-random numbers (Park-Miller), so every run tests the same inputs. */
function random(seed: number): () => number {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

const junk = ['{', '}', '(', ')', ';', ':', ',', '.', '|', '=', '"', '/*', '*', '+', '-', 'x', '1', 'def', 'element', 'grammar', '\'', '@'];

/** Copies of the input with deletions, stray characters and truncations; most of them have syntax errors. */
function mutations(input: string, count: number, seed: number): string[] {
    const next = random(seed);
    const at = (): number => Math.floor(next() * (input.length + 1));
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        const pos = at();
        switch (i % 4) {
            case 0: result.push(input.substring(0, pos) + input.substring(pos + 1 + Math.floor(next() * 12))); break;
            case 1: result.push(input.substring(0, pos) + junk[Math.floor(next() * junk.length)] + input.substring(pos)); break;
            case 2: result.push(input.substring(0, pos)); break;
            default: {
                const other = at();
                result.push(input.substring(0, pos) + input.substring(Math.min(pos, other), Math.max(pos, other)) + input.substring(pos));
            }
        }
    }
    return result;
}

/** The AST without CST nodes and container links, with references as their text. */
function astSnapshot(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }
    if (value instanceof Date) {
        return { date: isNaN(value.getTime()) ? 'invalid' : value.toISOString() };
    }
    if (typeof value !== 'object') {
        return `${typeof value}:${String(value)}`;
    }
    if (Array.isArray(value)) {
        return value.map(astSnapshot);
    }
    if (isReference(value)) {
        return { ref: value.$refText };
    }
    if (isMultiReference(value)) {
        return { multiRef: value.$refText };
    }
    const result: Record<string, unknown> = {};
    for (const [key, property] of Object.entries(value)) {
        if (!key.startsWith('$') || key === '$type') {
            result[key] = astSnapshot(property);
        }
    }
    return result;
}

function errorSnapshot(result: ParseResult): unknown {
    return {
        lexerErrors: result.lexerErrors.map(e => ({ message: e.message, offset: e.offset, length: e.length, line: e.line, column: e.column })),
        lexerReport: result.lexerReport,
        parserErrors: result.parserErrors.map(e => ({
            name: e.name,
            message: e.message,
            token: [e.token.image, e.token.startOffset, e.token.tokenType?.name],
            ruleStack: e.context?.ruleStack
        }))
    };
}

/** The CST in pre-order, together with the CST links of the AST (`$cstNode`, `$refNode`). */
function cstSnapshot(result: ParseResult): string[] {
    const lines: string[] = [];
    const root = result.value.$cstNode?.root;
    if (root) {
        for (const node of AstUtils.streamAst(result.value)) {
            lines.push(`ast ${String(node.$type)} ${node.$cstNode ? describeCst(node.$cstNode) : '-'}`);
        }
        for (const ref of allReferences(result.value)) {
            lines.push(`ref ${ref.property}=${ref.reference.$refText} ${ref.reference.$refNode ? describeCst(ref.reference.$refNode) : '-'}`);
        }
        const visit = (node: CstNode, depth: number): void => {
            lines.push(`${'  '.repeat(depth)}${describeCst(node)}`);
            if (isCompositeCstNode(node)) {
                node.content.forEach(child => visit(child, depth + 1));
            }
        };
        visit(root, 0);
    }
    return lines;
}

function describeCst(node: CstNode): string {
    const source = node.grammarSource?.$type ?? 'none';
    const kind = isLeafCstNode(node) ? `leaf ${node.tokenType.name} ${JSON.stringify(node.text)}` : `composite ${String(node.astNode.$type)}`;
    return `${kind} <${source}> [${node.offset},${node.end}]${node.hidden ? ' hidden' : ''}`;
}

function expectSameParse(parser: LangiumParser, input: string, options: Omit<ParserOptions, 'buildCst'> = {}): ParseResult {
    const withCst = parser.parse(input, options);
    const withoutCst = parser.parse(input, { ...options, buildCst: false });
    expect(withCst.value.$cstNode).toBeDefined();
    expect(astSnapshot(withoutCst.value)).toEqual(astSnapshot(withCst.value));
    expect(errorSnapshot(withoutCst)).toEqual(errorSnapshot(withCst));
    expectNoCst(withoutCst.value);
    return withCst;
}

/** Checks that no AST node has a CST node and no reference a `$refNode`; returns the number of references. */
function expectNoCst(root: AstNode): number {
    for (const node of AstUtils.streamAst(root)) {
        expect(node.$cstNode).toBeUndefined();
    }
    let references = 0;
    for (const ref of allReferences(root)) {
        expect(ref.reference.$refNode).toBeUndefined();
        references++;
    }
    return references;
}

function allReferences(root: AstNode): ReferenceInfo[] {
    return AstUtils.streamAst(root).flatMap(AstUtils.streamReferences).toArray();
}

interface Corpus {
    name: string
    parser: () => LangiumParser
    inputs: string[]
}

describe('parse with buildCst: false', () => {
    const parsers = new Map<string, LangiumParser>();
    const grammars: Record<string, string> = { Values: valuesGrammar, Expressions: expressionGrammar, Infix: infixGrammar };
    const grammarFiles = ['langium-grammar.langium', 'langium-types.langium'].map(file =>
        readFileSync(fileURLToPath(new URL(`../../src/grammar/${file}`, import.meta.url)), 'utf-8'));

    beforeAll(async () => {
        for (const [name, grammar] of Object.entries(grammars)) {
            const services = await createServicesForGrammar({ grammar });
            parsers.set(name, services.parser.LangiumParser);
        }
        parsers.set('Langium', createLangiumGrammarServices(EmptyFileSystem).grammar.parser.LangiumParser);
    });

    const corpora: Corpus[] = [
        { name: 'Values', parser: () => parsers.get('Values')!, inputs: valuesInputs },
        { name: 'Expressions', parser: () => parsers.get('Expressions')!, inputs: expressionInputs },
        { name: 'Infix', parser: () => parsers.get('Infix')!, inputs: infixInputs },
        // The grammar language: datatype rules, actions, cross-references, string and regex conversion
        { name: 'Langium', parser: () => parsers.get('Langium')!, inputs: [...grammarFiles, valuesGrammar, expressionGrammar, infixGrammar] }
    ];

    for (const corpus of corpora) {
        test(`${corpus.name}: inputs parse identically with and without a CST`, () => {
            for (const input of corpus.inputs) {
                expectSameParse(corpus.parser(), input);
            }
        });

        test(`${corpus.name}: mutated inputs parse identically with and without a CST`, () => {
            let withErrors = 0;
            let total = 0;
            corpus.inputs.forEach((input, index) => {
                for (const mutated of mutations(input, 40, index + 1)) {
                    const result = expectSameParse(corpus.parser(), mutated);
                    total++;
                    if (result.parserErrors.length > 0 || result.lexerErrors.length > 0) {
                        withErrors++;
                    }
                }
            });
            // Make sure that error recovery is actually exercised
            expect(withErrors).toBeGreaterThan(total / 4);
        });
    }

    test('values of all built-in kinds are converted', () => {
        const result = expectSameParse(parsers.get('Values')!, valuesInputs[2]);
        const withoutCst = parsers.get('Values')!.parse(valuesInputs[2], { buildCst: false }).value;
        // single, qualified and multi reference
        expect(expectNoCst(withoutCst)).toBe(3);
        expect(astSnapshot(withoutCst)).toMatchObject({
            elements: [{
                name: 'string:a', ext: 'string:x.y.z::u.v', int: 'number:42', str: 'string:s\t"q"', dec: 'number:3.25', flag: 'boolean:true',
                date: { date: new Date('2022-10-12T00:00').toISOString() }, big: 'bigint:149587349587234971', kw: 'string:second',
                num: 'number:-1.5', bool: 'boolean:true', bigdt: 'bigint:12345', datedt: { date: new Date('2022-10-12T00:00').toISOString() }
            }],
            refs: [{ single: { ref: 'a' }, qualified: { ref: 'x.y' }, multi: { multiRef: 'a' } }]
        });
        expect(result.parserErrors).toHaveLength(0);
    });

    test('a datatype rule as entry rule is converted the same way', () => {
        const parser = parsers.get('Values')!;
        for (const rule of ['QualifiedName', 'FQN', 'NumberDT', 'BoolDT', 'BigDT', 'DateDT']) {
            for (const input of ['a.b', 'a.b::c', '-1.5', 'true', '12', '"2022-10-12T00:00"']) {
                const withCst = parser.parse(input, { rule });
                const withoutCst = parser.parse(input, { rule, buildCst: false });
                expect(astSnapshot(withoutCst.value)).toEqual(astSnapshot(withCst.value));
                expect(errorSnapshot(withoutCst)).toEqual(errorSnapshot(withCst));
            }
        }
    });

    test('an empty optional subrule is not assigned, as with a CST', () => {
        const parser = parsers.get('Expressions')!;
        const result = parser.parse('def f: 1;', { buildCst: false }).value as AstNode & { statements: Array<{ modifiers?: unknown }> };
        expect(result.statements[0].modifiers).toBeUndefined();
        const withModifier = parser.parse('def static f: 1;', { buildCst: false }).value as AstNode & { statements: Array<{ modifiers?: unknown }> };
        expect(withModifier.statements[0].modifiers).toMatchObject({ $type: 'Modifiers', static: true });
    });

    test('the default is to build the CST, and buildCst: true changes nothing', () => {
        for (const corpus of corpora) {
            for (const input of corpus.inputs) {
                const parser = corpus.parser();
                const byDefault = parser.parse(input);
                const explicit = parser.parse(input, { buildCst: true });
                expect(byDefault.value.$cstNode).toBeDefined();
                expect(cstSnapshot(explicit)).toEqual(cstSnapshot(byDefault));
                expect(astSnapshot(explicit.value)).toEqual(astSnapshot(byDefault.value));
                expect(errorSnapshot(explicit)).toEqual(errorSnapshot(byDefault));
            }
        }
    });

    test('a CST-free parse in between does not change the next CST', () => {
        const parser = parsers.get('Expressions')!;
        const input = expressionInputs[3];
        const before = cstSnapshot(parser.parse(input));
        parser.parse(expressionInputs[0], { buildCst: false });
        parser.parse('eval + 3;', { buildCst: false });
        expect(cstSnapshot(parser.parse(input))).toEqual(before);
    });

    test('the CST builder does not keep the tree of a previous parse', () => {
        const parser = parsers.get('Expressions')!;
        const first = parser.parse('eval 1;');
        const builder = (parser as unknown as { nodeBuilder: { rootNode?: unknown, nodeStack: unknown[] } }).nodeBuilder;
        expect(builder.rootNode).toBe(first.value.$cstNode!.root);
        parser.parse('eval 2;', { buildCst: false });
        expect(builder.rootNode).toBeUndefined();
        expect(builder.nodeStack).toHaveLength(0);
        // The CST of the earlier parse result is not affected
        expect(first.value.$cstNode!.text).toBe('eval 1;');
    });

    // Pins the CST of the default parse; the snapshots were recorded before `buildCst` was introduced.
    test('the CST of a default parse is unchanged', () => {
        const parser = parsers.get('Expressions')!;
        expect(cstSnapshot(parser.parse('/* leading */ def f(a): /* c */ a * 2; /* trailing */'))).toMatchInlineSnapshot(`
          [
            "ast Model composite Model <none> [14,38]",
            "ast Definition composite Definition <RuleCall> [14,38]",
            "ast Param composite Param <RuleCall> [20,21]",
            "ast BinaryExpression composite BinaryExpression <RuleCall> [32,37]",
            "ast Call composite Call <RuleCall> [32,33]",
            "ast NumberLiteral composite NumberLiteral <RuleCall> [36,37]",
            "ref func=a leaf ID "a" <CrossReference> [32,33]",
            "composite Model <none> [14,38]",
            "  leaf ML_COMMENT "/* leading */" <none> [0,13] hidden",
            "  composite Definition <RuleCall> [14,38]",
            "    composite Definition <RuleCall> [14,38]",
            "      leaf def "def" <Keyword> [14,17]",
            "      leaf ID "f" <RuleCall> [18,19]",
            "      leaf ( "(" <Keyword> [19,20]",
            "      composite Param <RuleCall> [20,21]",
            "        leaf ID "a" <RuleCall> [20,21]",
            "      leaf ) ")" <Keyword> [21,22]",
            "      leaf : ":" <Keyword> [22,23]",
            "      leaf ML_COMMENT "/* c */" <none> [24,31] hidden",
            "      composite BinaryExpression <RuleCall> [32,37]",
            "        composite BinaryExpression <RuleCall> [32,37]",
            "          composite BinaryExpression <Action> [32,37]",
            "            composite Call <RuleCall> [32,33]",
            "              composite Call <RuleCall> [32,33]",
            "                composite Call <RuleCall> [32,33]",
            "                  leaf ID "a" <CrossReference> [32,33]",
            "            leaf * "*" <Keyword> [34,35]",
            "            composite NumberLiteral <RuleCall> [36,37]",
            "              composite NumberLiteral <RuleCall> [36,37]",
            "                leaf NUMBER "2" <RuleCall> [36,37]",
            "      leaf ; ";" <Keyword> [37,38]",
            "  leaf ML_COMMENT "/* trailing */" <none> [39,53] hidden",
          ]
        `);
        expect(cstSnapshot(parser.parse('eval + 3; eval 1 + ;'))).toMatchInlineSnapshot(`
          [
            "ast Model composite Model <none> [0,20]",
            "ast Evaluation composite Evaluation <RuleCall> [0,4]",
            "ast Evaluation composite Evaluation <RuleCall> [10,20]",
            "ast BinaryExpression composite BinaryExpression <RuleCall> [15,18]",
            "ast NumberLiteral composite NumberLiteral <RuleCall> [15,16]",
            "composite Model <none> [0,20]",
            "  composite Evaluation <RuleCall> [0,4]",
            "    composite Evaluation <RuleCall> [0,4]",
            "      leaf eval "eval" <Keyword> [0,4]",
            "  composite Evaluation <RuleCall> [10,20]",
            "    composite Evaluation <RuleCall> [10,20]",
            "      leaf eval "eval" <Keyword> [10,14]",
            "      composite BinaryExpression <RuleCall> [15,18]",
            "        composite BinaryExpression <Action> [15,18]",
            "          composite NumberLiteral <RuleCall> [15,16]",
            "            composite NumberLiteral <RuleCall> [15,16]",
            "              composite NumberLiteral <RuleCall> [15,16]",
            "                composite NumberLiteral <RuleCall> [15,16]",
            "                  leaf NUMBER "1" <RuleCall> [15,16]",
            "          leaf + "+" <Keyword> [17,18]",
            "      leaf ; ";" <Keyword> [19,20]",
          ]
        `);
        expect(cstSnapshot(parsers.get('Values')!.parse('element a ext x.y int 1 ref a qualified x.y'))).toMatchInlineSnapshot(`
          [
            "ast Model composite Model <none> [0,43]",
            "ast Element composite Element <RuleCall> [0,23]",
            "ast Ref composite Ref <RuleCall> [24,43]",
            "ref single=a leaf ID "a" <CrossReference> [28,29]",
            "ref qualified=x.y composite Ref <CrossReference> [40,43]",
            "composite Model <none> [0,43]",
            "  composite Element <RuleCall> [0,23]",
            "    leaf element "element" <Keyword> [0,7]",
            "    leaf ID "a" <RuleCall> [8,9]",
            "    leaf ext "ext" <Keyword> [10,13]",
            "    composite Element <RuleCall> [14,17]",
            "      composite Element <RuleCall> [14,17]",
            "        leaf ID "x" <RuleCall> [14,15]",
            "        leaf . "." <Keyword> [15,16]",
            "        leaf ID "y" <RuleCall> [16,17]",
            "    leaf int "int" <Keyword> [18,21]",
            "    leaf INT "1" <RuleCall> [22,23]",
            "  composite Ref <RuleCall> [24,43]",
            "    leaf ref "ref" <Keyword> [24,27]",
            "    leaf ID "a" <CrossReference> [28,29]",
            "    leaf qualified "qualified" <Keyword> [30,39]",
            "    composite Ref <CrossReference> [40,43]",
            "      leaf ID "x" <RuleCall> [40,41]",
            "      leaf . "." <Keyword> [41,42]",
            "      leaf ID "y" <RuleCall> [42,43]",
          ]
        `);
    });
});

describe('value converter contract for CST-free parsing', () => {

    const grammar = `
    grammar Test
    entry Model: (items+=Item)*;
    Item: name=ID ('=' value=INT)? ('ext' ext=QualifiedName)?;
    QualifiedName returns string: ID ('.' ID)*;
    terminal INT returns number: /[0-9]+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    hidden terminal WS: /\\s+/;
    `;

    /** Reads more of the CST node than its grammar element, so it must not be handed the stand-in. */
    class TextReadingConverter extends DefaultValueConverter {
        protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
            if (rule.name === 'INT') {
                return cstNode.text.length * 1000 + Number(input);
            }
            return super.runConverter(rule, input, cstNode);
        }
    }

    class RecordingConverter extends DefaultValueConverter {
        readonly received: CstNode[] = [];
        override get supportsCstFreeConversion(): boolean {
            return true;
        }
        override convert(input: string, cstNode: CstNode): ValueType {
            this.received.push(cstNode);
            return super.convert(input, cstNode);
        }
    }

    async function createServices(converter: () => ValueConverter): Promise<LangiumCoreServices> {
        return createServicesForGrammar({ grammar, module: { parser: { ValueConverter: converter } } });
    }

    test('DefaultValueConverter opts in for its own class only', () => {
        class Subclass extends DefaultValueConverter { }
        expect(new DefaultValueConverter().supportsCstFreeConversion).toBe(true);
        expect(new Subclass().supportsCstFreeConversion).toBe(false);
        expect(new TextReadingConverter().supportsCstFreeConversion).toBe(false);
        expect(new RecordingConverter().supportsCstFreeConversion).toBe(true);
    });

    test('without the opt-in, buildCst: false still builds the CST', async () => {
        const services = await createServices(() => new TextReadingConverter());
        const parser = services.parser.LangiumParser;
        const withCst = parser.parse('a = 7 b ext x.y');
        const requested = parser.parse('a = 7 b ext x.y', { buildCst: false });
        expect(requested.value.$cstNode).toBeDefined();
        expect(requested.value).toMatchObject({ items: [{ name: 'a', value: 1007 }, { name: 'b', ext: 'x.y' }] });
        expect(cstSnapshot(requested)).toEqual(cstSnapshot(withCst));
    });

    test('a converter that only implements the interface gets a CST', async () => {
        const services = await createServices(() => ({ convert: (input, cstNode) => new DefaultValueConverter().convert(input, cstNode) }));
        expect(services.parser.LangiumParser.parse('a = 7', { buildCst: false }).value.$cstNode).toBeDefined();
    });

    test('with the opt-in, the converter receives a stand-in that only carries the grammar element', async () => {
        const converter = new RecordingConverter();
        const services = await createServices(() => converter);
        const parser = services.parser.LangiumParser;
        const result = parser.parse('a = 7 b ext x.y', { buildCst: false });
        expect(result.value.$cstNode).toBeUndefined();
        expect(result.value).toMatchObject({ items: [{ name: 'a', value: 7 }, { name: 'b', ext: 'x.y' }] });
        expect(converter.received.length).toBeGreaterThan(0);
        for (const node of converter.received) {
            expect(Object.keys(node)).toEqual(['grammarSource']);
        }
    });
});

describe('documents parsed with buildCst: false', () => {

    const grammar = `
    grammar Refs
    entry Model: (elements+=Element)*;
    Element: 'element' name=ID ('extends' parent=[Element:ID])?;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    hidden terminal WS: /\\s+/;
    `;

    test('references are resolved, but are not in the reference index', async () => {
        const services = await createServicesForGrammar({ grammar });
        const parse = parseHelper<AstNode & { elements: Array<{ parent?: { ref?: AstNode } }> }>(services);
        const base = await parse('element Base', { documentUri: 'file:///base.txt', parserOptions: { buildCst: false } });
        const withoutCst = await parse('element A extends Base', { documentUri: 'file:///a.txt', parserOptions: { buildCst: false } });
        const withCst = await parse('element B extends Base', { documentUri: 'file:///b.txt' });

        expect(base.parseResult.value.$cstNode).toBeUndefined();
        expect(withoutCst.parseResult.value.$cstNode).toBeUndefined();
        expect(withoutCst.parseResult.value.elements[0].parent?.ref).toBe(base.parseResult.value.elements[0]);
        expect(withCst.parseResult.value.elements[0].parent?.ref).toBe(base.parseResult.value.elements[0]);
        // The exported name is found without a CST, but it has no source position
        const exported = services.shared.workspace.IndexManager.allElements().filter(e => e.name === 'Base').head();
        expect(exported?.nameSegment).toBeUndefined();

        // The reference description provider skips references without `$refNode`, so the index manager
        // does not know that the CST-free document depends on `base.txt`. An incremental update of
        // `base.txt` would not relink it.
        const changed = new Set([URI.parse('file:///base.txt').toString()]);
        const indexManager = services.shared.workspace.IndexManager;
        expect(indexManager.isAffected(withCst, changed)).toBe(true);
        expect(indexManager.isAffected(withoutCst, changed)).toBe(false);
    });
});
