/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstUtils, EmptyFileSystem, MultiMap, URI, type Grammar, type LangiumDocument } from 'langium';
import { CompositeGeneratorNode, expandToNode, expandToString, IndentNode, normalizeEOL, toString, type Generated } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { clearDocuments, expectNoIssues, parseHelper } from 'langium/test';
import { beforeEach, describe, expect, test } from 'vitest';
import { generate } from '../../src/generate.js';
import { generateAstMultiFileProject, generateAstSingleFileProject } from '../../src/generator/ast-generator.js';
import { getAstIdentifierForGrammarFile } from '../../src/generator/langium-util.js';
import type { LangiumConfig } from '../../src/package-types.js';
import { RelativePath } from '../../src/package-types.js';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parse = parseHelper<Grammar>(services.grammar);

describe('Ast generator (with a single *.langium file in the project only)', () => {

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
    const typesFileContent = generateAstSingleFileProject(services.grammar, [result.value], config);

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
    const typesFileContent = generateAstSingleFileProject(services.grammar, [result.value], config);
    let startIndex = typesFileContent.indexOf(start);
    for (let i = 0; i < startCount; i++) {
        startIndex = typesFileContent.indexOf(start, startIndex + start.length);
    }
    const relevantPart = typesFileContent.substring(startIndex, typesFileContent.indexOf(end)).trim();
    expect(relevantPart).toEqual(expectedPart);
}

describe('Ast generator (with multiple *.langium files)', () => {

    beforeEach(async () => {
        await clearDocuments(services.shared); // ensure that *.langium files from previous test cases are not existing anymore
    });

    // TODO (un)used terminals, no ID conflict with unrelated grammars!
    // TODO multi-language projects

    test('Multi-file project: Grammar "one" uses a type which is inferred in file "two"', async () => {
        await testMultiFilesProject(
            [{
                path: 'one.langium',
                languageID: 'one',
                grammarContent: `
                    grammar OneGrammar
                    import "two";
                    entry Entry: A | B;
                    A: 'a' a=ID;
                    terminal ID: /[a-zA-Z0-9]+/;
                    hidden terminal WS: /\s+/;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export const testFileOneTerminals = {
                            ID: /[a-zA-Z0-9]+/,
                            WS: /s+/,
                        };

                        export type testFileOneTerminalNames = keyof typeof testFileOneTerminals;

                        export type testFileOneKeywordNames =
                            | "a";

                        export type testFileOneTokenNames = testFileOneTerminalNames | testFileOneKeywordNames;

                    `, expandToString`
                        export type Entry = A | B;
                    `, expandToString`
                        export type testFileOneAstType = {
                            A: A
                            B: B
                            Entry: Entry
                        }
                    `, expandToStringIndented(2, expandToNode`
                        A: {
                            name: A.$type,
                            properties: {
                                a: {
                                    name: A.a
                                }
                            },
                            superTypes: [Entry.$type]
                        }
                    `)
                ],
            }, {
                path: 'two.langium',
                languageID: undefined,
                grammarContent: `
                    B: 'b' b=ID2;
                    terminal ID2: /[a-zA-Z0-9]+/;
                    hidden terminal WS2: /\s+/;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export const testFileTwoTerminals = {
                            ID2: /[a-zA-Z0-9]+/,
                            WS2: /s+/,
                        };

                        export type testFileTwoTerminalNames = keyof typeof testFileTwoTerminals;

                        export type testFileTwoKeywordNames =
                            | "b";

                        export type testFileTwoTokenNames = testFileTwoTerminalNames | testFileTwoKeywordNames;
                    `, expandToString`
                        export interface B extends langium.AstNode {
                            readonly $type: 'B';
                            b: string;
                        }

                        export const B = {
                            $type: 'B',
                            b: 'b'
                        } as const;

                        export function isB(item: unknown): item is B {
                            return reflection.isInstance(item, B.$type);
                        }
                    `, expandToString`
                        export type testFileTwoAstType = {
                            B: B
                        }
                    `, expandToStringIndented(2, expandToNode`
                        B: {
                            name: B.$type,
                            properties: {
                                b: {
                                    name: B.b
                                }
                            },
                            superTypes: [Entry.$type]
                        }
                    `)
                ],
            }],
            [expandToString`
                export const testTerminals = {
                    ...testFileOneTerminals,
                    ...testFileTwoTerminals,
                };

                export type testTerminalNames = keyof typeof testTerminals;

                export type testKeywordNames = testFileOneKeywordNames | testFileTwoKeywordNames;

                export type testTokenNames = testTerminalNames | testKeywordNames;
            `, expandToString`
                export type testAstType = testFileOneAstType & testFileTwoAstType
            `, expandToString`
                export const reflection = new testAstReflection();
            `]
        );
    });

    // TODO alle aufgelisteten Typen korrekt?
    test('Multi-file project: Types use types which are declared in (transitively) imported files', async () => {
        await testMultiFilesProject(
            [{
                path: 'one.langium',
                languageID: 'one',
                grammarContent: `
                    grammar OneGrammar
                    import "two";
                    entry Entry: 'a' a=ID;
                    type A = B | C;
                    terminal ID: /[a-zA-Z0-9]+/;
                    hidden terminal WS: /\s+/;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export const testFileOneTerminals = {
                            ID: /[a-zA-Z0-9]+/,
                            WS: /s+/,
                        };

                        export type testFileOneTerminalNames = keyof typeof testFileOneTerminals;

                        export type testFileOneKeywordNames =
                            | "a";

                        export type testFileOneTokenNames = testFileOneTerminalNames | testFileOneKeywordNames;

                    `, expandToString`
                        export type A = B | C;
                    `, expandToString`
                        export type testFileOneAstType = {
                            A: A
                            B: B
                            B1: B1
                            C: C
                            Entry: Entry
                        }
                    `
                ],
            }, {
                path: 'two.langium',
                languageID: undefined,
                grammarContent: `
                    import "three";
                    type B = C | B1;
                    interface B1 {
                        b1: string
                    }
                `,
                expectedAstContentParts: [
                    expandToString`
                        export type B = B1 | C;

                        export const B = {
                            $type: 'B'
                        } as const;

                        export function isB(item: unknown): item is B {
                            return reflection.isInstance(item, B.$type);
                        }
                    `, expandToString`
                        export interface B1 extends langium.AstNode {
                            readonly $type: 'B1';
                            b1: string;
                        }

                        export const B1 = {
                            $type: 'B1',
                            b1: 'b1'
                        } as const;

                        export function isB1(item: unknown): item is B1 {
                            return reflection.isInstance(item, B1.$type);
                        }
                    `, expandToString`
                        export type testFileTwoAstType = {
                            B: B
                            B1: B1
                            C: C
                        }
                    `
                ],
            }, {
                path: 'three.langium',
                languageID: undefined,
                grammarContent: `
                    interface C {
                        c: boolean
                    }
                `,
                expectedAstContentParts: [
                    expandToString`
                        export interface C extends langium.AstNode {
                            readonly $type: 'C';
                            c: boolean;
                        }

                        export const C = {
                            $type: 'C',
                            c: 'c'
                        } as const;

                        export function isC(item: unknown): item is C {
                            return reflection.isInstance(item, C.$type);
                        }
                    `, expandToString`
                        export type testFileThreeAstType = {
                            C: C
                        }
                    `
                ]
            }],
            [expandToString`
                export type testAstType = testFileOneAstType & testFileThreeAstType & testFileTwoAstType

                export class testAstReflection extends langium.AbstractAstReflection {
                    override readonly types = {
                        B1: {
                            name: B1.$type,
                            properties: {
                                b1: {
                                    name: B1.b1
                                }
                            },
                            superTypes: [B.$type]
                        },
                        C: {
                            name: C.$type,
                            properties: {
                                c: {
                                    name: C.c,
                                    defaultValue: false
                                }
                            },
                            superTypes: [A.$type, B.$type]
                        },
                        Entry: {
                            name: Entry.$type,
                            properties: {
                                a: {
                                    name: Entry.a
                                }
                            },
                            superTypes: []
                        }
                    } as const satisfies langium.AstMetaData
                }
            `]
        );
    });

    test('Multi-file project: Same name "test" for project, file name and language id', async () => {
        await testMultiFilesProject(
            [{
                path: 'test.langium',
                languageID: 'test',
                grammarContent: `
                        grammar Test
                        import "two";
                        entry Test returns Test: 'a' a=ID;
                        terminal ID: /[a-zA-Z0-9]+/;
                        hidden terminal WS: /\s+/;
                    `,
                expectedAstContentParts: [
                    expandToString`
                            export type testFileTestAstType = {
                                Test: Test
                            }
                        `
                ],
            }, {
                path: 'two.langium',
                languageID: undefined,
                grammarContent: `
                        interface Test {
                            a: string
                        }
                    `,
                expectedAstContentParts: [
                    expandToString`
                            export interface Test extends langium.AstNode {
                                readonly $type: 'Test';
                                a: string;
                            }

                            export const Test = {
                                $type: 'Test',
                                a: 'a'
                            } as const;

                            export function isTest(item: unknown): item is Test {
                                return reflection.isInstance(item, Test.$type);
                            }
                        `, expandToString`
                            export type testFileTwoAstType = {
                                Test: Test
                            }
                        `
                ],
            }],
            [expandToString`
                export type testAstType = testFileTestAstType & testFileTwoAstType

                export class testAstReflection extends langium.AbstractAstReflection {
                    override readonly types = {
                        Test: {
                            name: Test.$type,
                            properties: {
                                a: {
                                    name: Test.a
                                }
                            },
                            superTypes: []
                        }
                    } as const satisfies langium.AstMetaData
                }
            `]
        );
    });

    test('Multi-file project: Same name "test" for project, file name and language id (fails with grammar file names which produce non-unique identifiers)', async () => {
        expect(async () => await testMultiFilesProject(
            [{
                path: 'test.langium',
                languageID: 'test',
                grammarContent: `
                        grammar Test
                        import "myFolder/Test";
                        entry Test returns Test: 'a' a=ID;
                        terminal ID: /[a-zA-Z0-9]+/;
                        hidden terminal WS: /\s+/;
                    `,
                expectedAstContentParts: [],
            },{
                path: 'myFolder/Test.langium',
                languageID: undefined,
                grammarContent: `
                        interface Test {
                            a: string
                        }
                    `,
                expectedAstContentParts: [],
            }],
            []
        )).rejects.toThrowError("The grammars file:///test.langium, file:///myFolder/Test.langium result in the same identifier 'Test': Rename the file name(s) to make the grammar identifiers unique.");
    });

    test.skip('Use this test case for debugging the generation of the Arithmetics example (single-file project)', async () => {
        await generate({ file: 'examples/arithmetics/langium-config.json' });
    });
    test.skip('Use this test case for debugging the generation of Langium itself (multi-file project)', async () => {
        await generate({ file: 'packages/langium/langium-config.json' });
    });
    test.skip('Use this test case for debugging the generation of the Requirements example (multi-language project)', async () => {
        await generate({ file: 'examples/requirements/langium-config.json' });
    });
});

interface GrammarFile {
    path: string;
    languageID: string | undefined; // If not undefined, this grammar file is used as entry point for a language with the given value as 'id'
    grammarContent: string;
    expectedAstContentParts: string[];
}
/**
 *
 * @param grammarFiles at least two grammar files
 * @param moreExpectedParts the main 'ast.ts' content
 */
async function testMultiFilesProject(grammarFiles: GrammarFile[], moreExpectedParts: string[]): Promise<void> {
    if (grammarFiles.length <= 1) {
        throw new Error('At least two grammar files are expected here');
    }
    // collect all information
    const config: LangiumConfig = {
        [RelativePath]: './',
        projectName: 'test',
        languages: [], // will be filled later
    };
    const documents: LangiumDocument[] = [];
    const expectedParts: string[] = [];
    for (const file of grammarFiles) {
        const grammarFile = `file:///${file.path}`;
        const uri = URI.parse(grammarFile);
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(file.grammarContent, uri);
        services.shared.workspace.LangiumDocuments.addDocument(document);
        documents.push(document);
        expectedParts.push(...file.expectedAstContentParts);
        if (file.languageID) { // use this grammar file as entry point for a language
            config.languages.push({
                id: file.languageID,
                grammar: grammarFile,
            });
        }
    }
    expectedParts.push(...moreExpectedParts);

    // parse and build grammars
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    await documentBuilder.build(documents, { validation: true });
    const allGrammars = documents.map(d => d.parseResult.value as Grammar);

    // check for validation issues
    documents.forEach(document => expectNoIssues({
        document,
        diagnostics: document.diagnostics ?? [],
        dispose: async () => {},
    }));
    // check that the identifiers of the grammars are unique
    const mapCheckUnique: MultiMap<string, Grammar> = new MultiMap();
    allGrammars.forEach(grammar => mapCheckUnique.add(getAstIdentifierForGrammarFile(grammar), grammar));
    for (const [identifier, grammars] of mapCheckUnique.entriesGroupedByKey()) {
        if (grammars.length >= 2) {
            throw new Error(`The grammars ${grammars.map(g => AstUtils.getDocument(g).uri.toString()).join(', ')} result in the same identifier '${identifier}': Rename the file name(s) to make the grammar identifiers unique.`);
        }
    }

    // generate the ast.ts
    const generated = generateAstMultiFileProject(services.grammar, config, allGrammars);

    // check the generated content
    expectedParts.forEach(part => expect(generated).toContain(part));
}

function expandToStringIndented(columns: number, content: Generated): string {
    return toString(new CompositeGeneratorNode().append(new IndentNode(columns * 4 /*spaces*/).append(content)));
}
