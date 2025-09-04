/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, type AstNode, type LangiumCoreServices } from 'langium';
import { describe, expect, test, beforeEach } from 'vitest';
import { createLangiumGrammarServices, createServicesForGrammar  } from 'langium/grammar';
import { parseHelper  } from 'langium/test';

describe('Partial parsing', () => {
    const content = `
    grammar Test
    entry Model: 'model' (a+=A | b+=B)*;
    A: 'a' name=ID;
    B: 'b' name=ID;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    hidden terminal WS: /\\s+/;
    `;

    let services: LangiumCoreServices;

    beforeEach(async () => {
        services = await createServicesForGrammar({ grammar: content });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function expectCorrectParse(text: string, rule?: string): any {
        const result = services.parser.LangiumParser.parse(text, { rule });
        expect(result.parserErrors.length).toBe(0);
        return result.value;
    }

    function expectErrorneousParse(text: string, rule?: string): void {
        const result = services.parser.LangiumParser.parse(text, { rule });
        expect(result.parserErrors.length).toBeGreaterThan(0);
    }

    test('Should parse correctly with normal entry rule', () => {
        const result = expectCorrectParse('model a Foo b Bar');
        expect(result.a[0].name).toEqual('Foo');
        expect(result.b[0].name).toEqual('Bar');
    });

    test('Should parse correctly with alternative entry rule A', () => {
        const result = expectCorrectParse('a Foo', 'A');
        expect(result.name).toEqual('Foo');
        expectErrorneousParse('model a Foo', 'A');
        expectErrorneousParse('b Bar', 'A');
    });

    test('Should parse correctly with alternative entry rule B', () => {
        const result = expectCorrectParse('b Foo', 'B');
        expect(result.name).toEqual('Foo');
        expectErrorneousParse('model b Foo', 'B');
        expectErrorneousParse('a Foo', 'B');
    });

    test('Parse helper supports using alternative entry rule A', async () => {
        const parse = parseHelper<A>(services);
        const document = await parse('a Foo', { parserOptions: { rule: 'A' } });
        expect(document.parseResult.parserErrors.length).toBe(0);
        expect(document.parseResult.value.name).toEqual('Foo');
    });

});

describe('hidden node parsing', () => {

    test('finishes in expected time', async () => {
        const parser = createLangiumGrammarServices(EmptyFileSystem).grammar.parser.LangiumParser;
        let content = 'Rule:';
        // Adding hidden nodes used to cause exponential parsing time behavior
        for (let i = 0; i < 2500; i++) {
            content += "'a' /* A */ /* B */ /* C */\n";
        }
        content += ';';
        const start = Date.now();
        // This roughly takes 100-300 ms on a modern machine
        // If it takes longer, the hidden node parsing is likely to be exponential
        // On an older version of the parser, this took ~5 seconds
        const result = parser.parse(content);
        expect(result.lexerErrors).toHaveLength(0);
        expect(result.parserErrors).toHaveLength(0);
        const end = Date.now();
        expect(end - start).toBeLessThan(1000);
    });

});

describe('parser error recovery', () => {

    for (const [open, close] of [[1, 0], [2, 0], [3, 0], [2, 1], [3, 1], [3, 2]]) {
        test(`recovers from lexer error with ${open} open and ${close} close parenthesis`, async () => {
            const text = `
                grammar Test
                entry Model: value=Expr ';';
                Expr: '(' Expr ')' | value=ID;
                terminal ID: /[_a-zA-Z][\\w_]*/;
                hidden terminal WS: /\\s+/;
            `;
            const services = await createServicesForGrammar({ grammar: text });
            const opening = '('.repeat(open);
            const closing = ')'.repeat(close);
            const result = services.parser.LangiumParser.parse(`${opening}a${closing};`);
            // Expect only one parser error independent of the number of missing closing parenthesis
            expect(result.parserErrors).toHaveLength(1);
        });
    }

});

interface A extends AstNode {
    name: string
}

describe('Infix operator parsing', async () => {

    const grammar = `
        grammar Test
        entry Model: expr=Expr;
        Expr: BinaryExpr;
        infix BinaryExpr on PrimaryExpr:
            '*' | '/'
            > '+' | '-'
            > right assoc '=' | '*=' | '/=' | '+=' | '-=';

        PrimaryExpr: '(' expr=Expr ')' | value=Number;

        terminal Number: /[0-9]+/;
        hidden terminal WS: /\\s+/;
    `;

    const services = await createServicesForGrammar({ grammar });
    const parse = parseHelper<AstNode>(services);

    test('Should parse infix operator with standalone expr', async () => {
        await expectExpr('1', '1');
    });

    test('Should not throw when parsing an empty expression', async () => {
        await expectExpr('', 'undefined', 1);
    });

    test('Should parse infix operator with two expressions', async () => {
        await expectExpr('1 + 2', '(1 + 2)');
    });

    test('Should parse infix operator with correct precedence #1', async () => {
        await expectExpr('1 + 2 * 3', '(1 + (2 * 3))');
        await expectExpr('1 + 2 + 3', '((1 + 2) + 3)');
    });

    test('Should parse infix operator with correct precedence #2', async () => {
        await expectExpr('1 + 2 * 3 + 4', '((1 + (2 * 3)) + 4)');
        // Note that the precedence of '*' is the same as '/' and that they are left associative
        await expectExpr('1 + 2 * 3 / 4', '(1 + ((2 * 3) / 4))');
        await expectExpr('1 + 2 * 3 - 4', '((1 + (2 * 3)) - 4)');
    });

    test('Should parse infix operator with correct associativity', async () => {
        await expectExpr('1 = 2 + 3', '(1 = (2 + 3))');
        await expectExpr('1 + 2 + 3', '((1 + 2) + 3)');
        // Note that = is right associative. If it were left associative, the result would be ((1 = 2) = 3)
        await expectExpr('1 = 2 = 3', '(1 = (2 = 3))');
    });

    test('Should parse incomplete infix operator', async () => {
        await expectExpr('1 + 2 -', '((1 + 2) - undefined)', 1);
    });

    async function expectExpr(text: string, expected: string, errors: number = 0): Promise<void> {
        const document = await parse(text);
        expect(document.parseResult.parserErrors.length).toBe(errors);
        const expr = document.parseResult.value as ExprModel;
        expect(stringifyExpr(expr.expr)).toEqual(expected);
    }

    function stringifyExpr(expr: Expr): string {
        if (expr === undefined) {
            return 'undefined';
        } else if (expr.$type === 'BinaryExpr') {
            const bin = expr as BinaryExpr;
            return `(${stringifyExpr(bin.left)} ${bin.operator} ${stringifyExpr(bin.right)})`;
        } else if (expr.$type === 'PrimaryExpr') {
            const prim = expr as PrimaryExpr;
            return prim.value || `(${stringifyExpr(prim.expr!)})`;
        }
        return '';
    }
});

interface ExprModel extends AstNode {
    expr: Expr;
}

type Expr = BinaryExpr | PrimaryExpr;

interface BinaryExpr extends AstNode {
    operator: string;
    left: Expr;
    right: Expr;
}

interface PrimaryExpr extends AstNode {
    expr?: Expr;
    value?: string;
}
