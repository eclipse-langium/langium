/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, type Grammar } from 'langium';
import { expandToString, normalizeEOL } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { generateAst } from '../../src/generator/ast-generator.js';
import type { LangiumConfig } from '../../src/package-types.js';
import { RelativePath } from '../../src/package-types.js';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parse = parseHelper<Grammar>(services.grammar);

describe('Ast generator', () => {

    test('should generate checker functions for datatype rules comprised of a single string', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            'a';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = 'a';

        export function isA(item: unknown): item is A {
            return item === 'a';
        }
    `));

    test('should generate checker functions for datatype rules comprised of a multiple strings', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            'a' | 'b' | 'c';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = 'a' | 'b' | 'c';

        export function isA(item: unknown): item is A {
            return item === 'a' || item === 'b' || item === 'c';
        }
    `));

    test('should generate checker functions for datatype rules with subtypes', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            'a';

        AB returns string:
            A | 'b';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = 'a';

        export function isA(item: unknown): item is A {
            return item === 'a';
        }

        export type AB = 'b' | A;

        export function isAB(item: unknown): item is AB {
            return isA(item) || item === 'b';
        }
    `));

    test('should generate checker functions for datatype rules referencing a terminal', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            ID;

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = string;

        export function isA(item: unknown): item is A {
            return (typeof item === 'string' && (/[_a-zA-Z][\\w_]*/.test(item)));
        }
    `));

    test('should generate checker functions for datatype rules referencing multiple terminals', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            ID | STRING;

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        terminal STRING: /"(\\\\.|[^"\\\\])*"|'(\\\\.|[^'\\\\])*'/;
    `, expandToString`
        export type A = string;

        export function isA(item: unknown): item is A {
            return (typeof item === 'string' && (/[_a-zA-Z][\\w_]*/.test(item) || /"(\\\\.|[^"\\\\])*"|'(\\\\.|[^'\\\\])*'/.test(item)));
        }
    `));

    test('should generate checker functions for datatype rules with nested union', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            'a';

        B returns string:
            'b';

        C returns string:
            'c';

        ABC returns string:
            A | ( B | C );

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = 'a';

        export function isA(item: unknown): item is A {
            return item === 'a';
        }

        export type ABC = (B | C) | A;

        export function isABC(item: unknown): item is ABC {
            return isA(item) || isB(item) || isC(item);
        }

        export type B = 'b';

        export function isB(item: unknown): item is B {
            return item === 'b';
        }

        export type C = 'c';

        export function isC(item: unknown): item is C {
            return item === 'c';
        }
    `));

    test('should generate checker functions for datatype rules with repeated terminals', () => testGeneratedAst(`
        grammar TestGrammar

        A returns string:
            ID ('.' ID)*;

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = string;

        export function isA(item: unknown): item is A {
            return typeof item === 'string';
        }
    `));

    test('should escape string delimiters in property type', () => testGeneratedInterface(`
        grammar TestGrammar

        entry Test: value="'test'";

        hidden terminal WS: /\\s+/;
    `, expandToString`
        export interface Test extends langium.AstNode {
            readonly $type: 'Test';
            value: '\\\'test\\\'';
        }

        export const Test = {
            $type: 'Test',
            value: 'value'
        } as const;

        export function isTest(item: unknown): item is Test {
            return reflection.isInstance(item, Test.$type);
        }
    `));

    test('should generate checker functions for datatype rules of type number', () => testGeneratedAst(`
        grammar TestGrammar

        A returns number: '1';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = number;

        export function isA(item: unknown): item is A {
            return typeof item === 'number';
        }
    `));

    test('check generated property with datatype rule of type number: single-value', () => testGeneratedAst(`
        grammar TestGrammar

        Node: num=A;
        A returns number: '1';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = number;

        export function isA(item: unknown): item is A {
            return typeof item === 'number';
        }

        export interface Node extends langium.AstNode {
            readonly $type: 'Node';
            num: A;
        }

        export const Node = {
            $type: 'Node',
            num: 'num'
        } as const;

        export function isNode(item: unknown): item is Node {
            return reflection.isInstance(item, Node.$type);
        }
    `));

    test('check generated property with datatype rule of type number: multi-value', () => testGeneratedAst(`
        grammar TestGrammar

        Node: num+=A*;
        A returns number: '1';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = number;

        export function isA(item: unknown): item is A {
            return typeof item === 'number';
        }

        export interface Node extends langium.AstNode {
            readonly $type: 'Node';
            num: Array<A>;
        }

        export const Node = {
            $type: 'Node',
            num: 'num'
        } as const;

        export function isNode(item: unknown): item is Node {
            return reflection.isInstance(item, Node.$type);
        }
    `));

    test('should generate checker functions for datatype rules of type boolean', () => testGeneratedAst(`
        grammar TestGrammar

        A returns boolean: 'on';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = boolean;

        export function isA(item: unknown): item is A {
            return typeof item === 'boolean';
        }
    `));

    test('should generate checker functions for datatype rules of type bigint', () => testGeneratedAst(`
        grammar TestGrammar

        A returns bigint: '1';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = bigint;

        export function isA(item: unknown): item is A {
            return typeof item === 'bigint';
        }
    `));

    test('should generate checker functions for datatype rules of type Date', () => testGeneratedAst(`
        grammar TestGrammar

        A returns Date: '2023-01-01';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = Date;

        export function isA(item: unknown): item is A {
            return item instanceof Date;
        }
    `));

    test('should generate terminal names and regular expressions', () => testTerminalConstants(`
        grammar TestGrammar

        entry Hello:
            'Hello, ' name=ID '!';

        hidden terminal WS: /\\s+/;

        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export const TestTerminals = {
            WS: /\\s+/,
            ID: /[_a-zA-Z][\\w_]*/,
        };
    `));

    test('should generate EBNF terminals with range operator', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=NUMBER;

        terminal NUMBER: '0'..'9'+;
    `, expandToString`
        export const TestTerminals = {
            NUMBER: /[0-9]+/,
        };
    `));

    test('should generate EBNF terminals with groups', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=Literal;

        terminal Literal: /PRE#/? '0'..'9' /#SUF?/;
    `, expandToString`
        export const TestTerminals = {
            Literal: /PRE#?[0-9]#SUF?/,
        };
    `));

    test('should generate EBNF terminals with parenthesized groups', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=Literal;

        terminal Literal: (/PRE#/)? ('0'..'9' /#SUF?/);
    `, expandToString`
        export const TestTerminals = {
            Literal: /(PRE#)?([0-9]#SUF?)/,
        };
    `));

    test('should generate EBNF terminals with alternatives', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=Literal;

        terminal Literal: '0'..'9' | /PRE#/ '0'..'9' /#SUF/;
    `, expandToString`
        export const TestTerminals = {
            Literal: /[0-9]|PRE#[0-9]#SUF/,
        };
    `));

    test('should generate EBNF terminals with parenthesized alternatives', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=Literal;

        terminal Literal: ((/PRE#/ | /P#/) '0'..'9') ((/#SUF/ | /S#/))?;    // Note: double parentheses are 'merged' during parsing, not reflected in the AST
    `, expandToString`
        export const TestTerminals = {
            Literal: /((PRE#|P#)[0-9])(#SUF|S#)?/,
        };
    `));

    test('should generate EBNF terminals with fragment references', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=NUMBER;

        terminal NUMBER: DIGIT;
        terminal fragment DIGIT: '0'..'9';
    `, expandToString`
        export const TestTerminals = {
            NUMBER: /(?:[0-9])/,
        };
    `));

    test('should generate EBNF terminals with parenthesized fragment references', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=NUMBER;

        terminal NUMBER: (DIGIT);
        terminal fragment DIGIT: '0'..'9';
    `, expandToString`
        export const TestTerminals = {
            NUMBER: /([0-9])/,
        };
    `));

    test('should generate EBNF terminals with referenced fragments with parenthesized content 1', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=NUMBER;

        terminal NUMBER: DIGIT+;
        terminal fragment DIGIT: ('0'..'9');
    `, expandToString`
        export const TestTerminals = {
            NUMBER: /(?:([0-9]))+/,
        };
    `));

    test('should generate EBNF terminals with referenced fragments with parenthesized content 2', () => testTerminalConstants(`
        grammar TestGrammar

        entry Value: value=NUMBER;

        terminal NUMBER: DIGIT+;
        terminal fragment DIGIT: ('0'..'9') '_'?;
    `, expandToString`
        export const TestTerminals = {
            NUMBER: /(?:([0-9])_?)+/,
        };
    `));

    test('should generate terminal constants with slashes', () => testTerminalConstants(`
        grammar TestGrammar

        entry Model:
            value=COMMENT;

        terminal COMMENT: '//';
    `, expandToString`
        export const TestTerminals = {
            COMMENT: /\\/\\//,
        };
    `));

    test('should generate property metadata for super types', () => testTypeMetaData(`
        grammar TestGrammar

        interface IAmArray {
            elements: ArrayContent[];
        }
        interface DeclaredArray extends IAmArray{ }

        DeclaredArray returns DeclaredArray:
            'declared' (elements+=ArrayContent)* ';';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export class testAstReflection extends langium.AbstractAstReflection {
            override readonly types = {
                DeclaredArray: {
                    name: DeclaredArray.$type,
                    properties: {
                        elements: {
                            name: DeclaredArray.elements,
                            defaultValue: []
                        }
                    },
                    superTypes: [IAmArray.$type]
                },
                IAmArray: {
                    name: IAmArray.$type,
                    properties: {
                        elements: {
                            name: IAmArray.elements,
                            defaultValue: []
                        }
                    },
                    superTypes: []
                }
            } as const satisfies langium.AstMetaData
        }`
    ));

    test('should generate property metadata for empty types', () => testTypeMetaData(`
        grammar TestGrammar

        interface IAmArray { }
        interface DeclaredArray extends IAmArray{
            elements: ArrayContent[];
        }

        DeclaredArray returns DeclaredArray:
            'declared' (elements+=ArrayContent)* ';';

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export class testAstReflection extends langium.AbstractAstReflection {
            override readonly types = {
                DeclaredArray: {
                    name: DeclaredArray.$type,
                    properties: {
                        elements: {
                            name: DeclaredArray.elements,
                            defaultValue: []
                        }
                    },
                    superTypes: [IAmArray.$type]
                },
                IAmArray: {
                    name: IAmArray.$type,
                    properties: {
                    },
                    superTypes: []
                }
            } as const satisfies langium.AstMetaData
        }`
    ));

    test('should generate escaped default value', () => testTypeMetaData(`
        grammar TestGrammar

        interface Test {
            value: string = "'test'";
        }

        Test returns Test:
            value=ID;

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export class testAstReflection extends langium.AbstractAstReflection {
            override readonly types = {
                Test: {
                    name: Test.$type,
                    properties: {
                        value: {
                            name: Test.value,
                            defaultValue: '\\'test\\''
                        }
                    },
                    superTypes: []
                }
            } as const satisfies langium.AstMetaData
        }`
    ));

    test('check all referenceIds are properly generated', () => testReferenceType(`
        grammar TestGrammar

        interface A {
            refA1: @A
            refB1: @B
        }
        interface B extends A {
            refB2: @B
        }
        interface C extends A, B {
            refC1: @C
        }
        interface D extends A, B {
            refD1: @D
        }
    `, expandToString`
        export class testAstReflection extends langium.AbstractAstReflection {
            override readonly types = {
                A: {
                    name: A.$type,
                    properties: {
                        refA1: {
                            name: A.refA1,
                            referenceType: A.$type
                        },
                        refB1: {
                            name: A.refB1,
                            referenceType: B.$type
                        }
                    },
                    superTypes: []
                },
                B: {
                    name: B.$type,
                    properties: {
                        refA1: {
                            name: B.refA1,
                            referenceType: A.$type
                        },
                        refB1: {
                            name: B.refB1,
                            referenceType: B.$type
                        },
                        refB2: {
                            name: B.refB2,
                            referenceType: B.$type
                        }
                    },
                    superTypes: [A.$type]
                },
                C: {
                    name: C.$type,
                    properties: {
                        refA1: {
                            name: C.refA1,
                            referenceType: A.$type
                        },
                        refB1: {
                            name: C.refB1,
                            referenceType: B.$type
                        },
                        refB2: {
                            name: C.refB2,
                            referenceType: B.$type
                        },
                        refC1: {
                            name: C.refC1,
                            referenceType: C.$type
                        }
                    },
                    superTypes: [A.$type, B.$type]
                },
                D: {
                    name: D.$type,
                    properties: {
                        refA1: {
                            name: D.refA1,
                            referenceType: A.$type
                        },
                        refB1: {
                            name: D.refB1,
                            referenceType: B.$type
                        },
                        refB2: {
                            name: D.refB2,
                            referenceType: B.$type
                        },
                        refD1: {
                            name: D.refD1,
                            referenceType: D.$type
                        }
                    },
                    superTypes: [A.$type, B.$type]
                }
            } as const satisfies langium.AstMetaData
        }`
    ));
});

async function testTerminalConstants(grammar: string, expected: string) {
    const result = (await parse(grammar)).parseResult;
    const config: LangiumConfig = {
        [RelativePath]: './',
        projectName: 'Test',
        languages: []
    };
    const expectedPart = normalizeEOL(expected).trim();
    const typesFileContent = generateAst(services.grammar, [result.value], config);

    const start = typesFileContent.indexOf(`export const ${config.projectName}Terminals`);
    const end = typesFileContent.indexOf('};', start) + 2;
    const relevantPart = typesFileContent.substring(start, end).trim();
    expect(relevantPart).toEqual(expectedPart);
}

async function testGeneratedInterface(grammar: string, expected: string): Promise<void> {
    return testGenerated(grammar, expected, 'export interface', 'export type testAstType');
}

async function testGeneratedAst(grammar: string, expected: string): Promise<void> {
    return testGenerated(grammar, expected, 'export type', 'export type testAstType', 3);
}

async function testTypeMetaData(grammar: string, expected: string): Promise<void> {
    return testGenerated(grammar, expected, 'export class testAstReflection', 'export const reflection');
}

async function testReferenceType(grammar: string, expected: string): Promise<void> {
    return testGenerated(grammar, expected, 'export class testAstReflection', 'export const reflection');
}

async function testGenerated(grammar: string, expected: string, start: string, end: string, startCount = 0): Promise<void> {
    const result = (await parse(grammar)).parseResult;
    const config: LangiumConfig = {
        [RelativePath]: './',
        projectName: 'test',
        languages: []
    };
    const expectedPart = normalizeEOL(expected).trim();
    const typesFileContent = generateAst(services.grammar, [result.value], config);
    let startIndex = typesFileContent.indexOf(start);
    for (let i = 0; i < startCount; i++) {
        startIndex = typesFileContent.indexOf(start, startIndex + start.length);
    }
    const relevantPart = typesFileContent.substring(startIndex, typesFileContent.indexOf(end)).trim();
    expect(relevantPart).toEqual(expectedPart);
}
