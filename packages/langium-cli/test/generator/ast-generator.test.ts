/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, URI, type Grammar, type LangiumDocument } from 'langium';
import { expandToNode, expandToString, normalizeEOL, toString, type Generated } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { clearDocuments, expectNoIssues, parseHelper } from 'langium/test';
import { beforeEach, describe, expect, test } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver-types';
import { embedGrammars, generate } from '../../src/generate.js';
import { generateAstMultiLanguageProject, generateAstSingleLanguageProject, getLanguageIdentifier, type LanguageInfo } from '../../src/generator/ast-generator.js';
import type { LangiumConfig, LangiumLanguageConfig } from '../../src/package-types.js';
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
    const typesFileContent = generateAstSingleLanguageProject(services.grammar, result.value, config);

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
    const typesFileContent = generateAstSingleLanguageProject(services.grammar, result.value, config);
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

    test('Single-language project with multiple files: Grammar "one" uses a type which is inferred in file "two", but rule in "two" is not reachable', async () => {
        await testMultiProject(
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
                    expandToNode`
                        ${undefined /* tweak the template to have more indentation */}
                                A: {
                                    name: A.$type,
                                    properties: {
                                        a: {
                                            name: A.a
                                        }
                                    },
                                    superTypes: [Entry.$type]
                                }
                    `
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
                    expandToNode`
                        ${undefined /* tweak the template to have more indentation */}
                                B: {
                                    name: B.$type,
                                    properties: {
                                        b: {
                                            name: B.b
                                        }
                                    },
                                    superTypes: [Entry.$type]
                                }
                    `
                ],
            }],
            expandToString`
                export type Entry = A | B;

                export const Entry = {
                    $type: 'Entry'
                } as const;

                export function isEntry(item: unknown): item is Entry {
                    return reflection.isInstance(item, Entry.$type);
                }

                export interface A extends langium.AstNode {
                    readonly $type: 'A';
                    a: string;
                }

                export const A = {
                    $type: 'A',
                    a: 'a'
                } as const;

                export function isA(item: unknown): item is A {
                    return reflection.isInstance(item, A.$type);
                }

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
                export type testAstType = {
                    A: A
                    B: B
                    Entry: Entry
                }
            `, expandToString`
                export const testTerminals = {
                    ID: /[a-zA-Z0-9]+/,
                    WS: /s+/,
                };

                export type testTerminalNames = keyof typeof testTerminals;

                export type testKeywordNames =
                    | "a";

                export type testTokenNames = testTerminalNames | testKeywordNames;
            `, expandToString`
                export const reflection = new testAstReflection();
            `
        );
    });

    test('Single-language project with multiple files: Types use types which are declared in (transitively) imported files', async () => {
        await testMultiProject(
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
                        export type A = B | C;
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
                    `
                ]
            }],
            expandToString`
                export const testTerminals = {
                    ID: /[a-zA-Z0-9]+/,
                    WS: /s+/,
                };

                export type testTerminalNames = keyof typeof testTerminals;

                export type testKeywordNames =
                    | "a";

                export type testTokenNames = testTerminalNames | testKeywordNames;
            `, expandToString`
                export class testAstReflection extends langium.AbstractAstReflection {
                    override readonly types = {
                        A: {
                            name: A.$type,
                            properties: {
                            },
                            superTypes: []
                        },
                        B: {
                            name: B.$type,
                            properties: {
                            },
                            superTypes: [A.$type]
                        },
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
            `, expandToString`
                export type testAstType = {
                    A: A
                    B: B
                    B1: B1
                    C: C
                    Entry: Entry
                }
            `
        );
    });

    test('Single-language project with multiple files: Same name "test" for project, file name and language id', async () => {
        await testMultiProject(
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
                expectedAstContentParts: [],
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
                    `
                ],
            }],
            expandToString`
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
            `
        );
    });

    test('Single-language project with multiple files: Same name "test" for project, file name and language id (works even with grammar file names which produce non-unique identifiers)', async () => {
        await testMultiProject(
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
            }]
        );
    });

    test('Multi-language project: 2 languages, both import another grammar file', async () => {
        await testMultiProject(
            [{
                path: 'one.langium',
                languageID: 'one',
                grammarContent: `
                    grammar OneGrammar
                    import "three";
                    entry Entry1: 'a' a1=ID;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace OneGrammar {

                            export const Terminals = {
                                ID: /[a-zA-Z]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "a";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                Entry1: Entry1
                            }

                        }
                    `
                ],
            }, {
                path: 'two.langium',
                languageID: 'two',
                grammarContent: `
                    grammar TwoGrammar
                    import "three";
                    entry Entry2: 'b' b1=INT;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace TwoGrammar {

                            export const Terminals = {
                                INT: /[0-9]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "b";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                Entry2: Entry2
                            }

                        }
                    `
                ],
            }, {
                path: 'three.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID: /[a-zA-Z]+/;
                    terminal INT: /[0-9]+/;
                    hidden terminal WS: /\s+/;
                `,
                expectedAstContentParts: [],
            }],
            expandToString`
                export const testTerminals = {
                    ...OneGrammar.Terminals,
                    ...TwoGrammar.Terminals,
                };

                export type testTerminalNames = keyof typeof testTerminals;

                export type testKeywordNames = OneGrammar.KeywordNames | TwoGrammar.KeywordNames;

                export type testTokenNames = testTerminalNames | testKeywordNames;
            `, expandToString`
                export type testAstType = OneGrammar.AstType & TwoGrammar.AstType
            `
        );
    });

    test('Multi-language project: 2 languages, both import a different grammar file which import each other', async () => {
        await testMultiProject(
            [{
                path: 'one.langium',
                languageID: 'one',
                grammarContent: `
                    grammar OneGrammar
                    import "oneCommon";
                    entry Entry1: 'a' a1=ID a2=C1;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace OneGrammar {

                            export const Terminals = {
                                ID: /[a-zA-Z]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "a"
                                | "c1"
                                | "c2";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                Entry1: Entry1
                            }

                        }
                    `
                ],
            }, {
                path: 'two.langium',
                languageID: 'two',
                grammarContent: `
                    grammar TwoGrammar
                    import "twoCommon";
                    entry Entry2: 'b' b1=INT b2=C2;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace TwoGrammar {

                            export const Terminals = {
                                INT: /[0-9]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "b"
                                | "c1"
                                | "c2";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                Entry2: Entry2
                            }

                        }
                    `
                ],
            }, {
                path: 'oneCommon.langium',
                languageID: undefined,
                grammarContent: `
                    import "twoCommon"
                    terminal ID: /[a-zA-Z]+/;
                    hidden terminal WS: /\s+/;
                    C1: 'c1' (c1=C2)?;
                `,
                expectedAstContentParts: [],
            }, {
                path: 'twoCommon.langium',
                languageID: undefined,
                grammarContent: `
                    import "oneCommon"
                    terminal INT: /[0-9]+/;
                    C2: 'c2' (c2=C1)?;
                `,
                expectedAstContentParts: [],
            }],
            expandToString`
                export interface C1 extends langium.AstNode {
                    readonly $container: C2 | Entry1;
                    readonly $type: 'C1';
                    c1?: C2;
                }

                export const C1 = {
                    $type: 'C1',
                    c1: 'c1'
                } as const;

                export function isC1(item: unknown): item is C1 {
                    return reflection.isInstance(item, C1.$type);
                }

                export interface C2 extends langium.AstNode {
                    readonly $container: C1 | Entry2;
                    readonly $type: 'C2';
                    c2?: C1;
                }

                export const C2 = {
                    $type: 'C2',
                    c2: 'c2'
                } as const;

                export function isC2(item: unknown): item is C2 {
                    return reflection.isInstance(item, C2.$type);
                }
            `, expandToString`
                export const testTerminals = {
                    ...OneGrammar.Terminals,
                    ...TwoGrammar.Terminals,
                };

                export type testTerminalNames = keyof typeof testTerminals;

                export type testKeywordNames = OneGrammar.KeywordNames | TwoGrammar.KeywordNames;

                export type testTokenNames = testTerminalNames | testKeywordNames;
            `
        );
    });

    test('Multi-language project: 3 languages, language "Two" depends on language "One", language "Three" depends on language "Two"', async () => {
        await testMultiProject(
            [{
                path: 'one.langium',
                languageID: 'one',
                grammarContent: `
                    grammar OneGrammar
                    import "oneCommon";
                    entry Entry1: 'a' a1=ID1 a2=C1;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace OneGrammar {

                            export const Terminals = {
                                ID1: /[a-z]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "a"
                                | "c1";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                Entry1: Entry1
                            }

                        }
                    `
                ],
            }, {
                path: 'two.langium',
                languageID: 'two',
                grammarContent: `
                    grammar TwoGrammar
                    import "twoCommon";
                    import "one";
                    entry Entry2: 'b' b1=ID1 b2=C2;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace TwoGrammar {

                            export const Terminals = {
                                ID2: /[A-Z]+/,
                                ID1: /[a-z]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "b"
                                | "c2";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                Entry1: Entry1
                                Entry2: Entry2
                            }

                        }
                    `
                ],
            }, {
                path: 'three.langium',
                languageID: 'three',
                grammarContent: `
                    grammar ThreeGrammar
                    import "threeCommon";
                    import "two";
                    entry Entry3: 'c' c1=ID1 c2=C3;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace ThreeGrammar {

                            export const Terminals = {
                                ID3: /[0-9]+/,
                                ID1: /[a-z]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "c"
                                | "c3";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                C3: C3
                                Entry1: Entry1
                                Entry2: Entry2
                                Entry3: Entry3
                            }

                        }
                    `
                ],
            }, {
                path: 'oneCommon.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID1: /[a-z]+/;
                    hidden terminal WS: /\s+/;
                    C1: 'c1' c1=ID1;
                `,
                expectedAstContentParts: [],
            }, {
                path: 'twoCommon.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID2: /[A-Z]+/;
                    C2: 'c2' c2=ID2;
                `,
                expectedAstContentParts: [],
            }, {
                path: 'threeCommon.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID3: /[0-9]+/;
                    C3: 'c3' c3=ID3;
                `,
                expectedAstContentParts: [],
            }],
            expandToString`
                export interface C1 extends langium.AstNode {
                    readonly $container: Entry1;
                    readonly $type: 'C1';
                    c1: string;
                }

                export const C1 = {
                    $type: 'C1',
                    c1: 'c1'
                } as const;

                export function isC1(item: unknown): item is C1 {
                    return reflection.isInstance(item, C1.$type);
                }

                export interface C2 extends langium.AstNode {
                    readonly $container: Entry2;
                    readonly $type: 'C2';
                    c2: string;
                }

                export const C2 = {
                    $type: 'C2',
                    c2: 'c2'
                } as const;

                export function isC2(item: unknown): item is C2 {
                    return reflection.isInstance(item, C2.$type);
                }

                export interface C3 extends langium.AstNode {
                    readonly $container: Entry3;
                    readonly $type: 'C3';
                    c3: string;
                }

                export const C3 = {
                    $type: 'C3',
                    c3: 'c3'
                } as const;

                export function isC3(item: unknown): item is C3 {
                    return reflection.isInstance(item, C3.$type);
                }

                export interface Entry1 extends langium.AstNode {
                    readonly $type: 'Entry1';
                    a1: string;
                    a2: C1;
                }

                export const Entry1 = {
                    $type: 'Entry1',
                    a1: 'a1',
                    a2: 'a2'
                } as const;

                export function isEntry1(item: unknown): item is Entry1 {
                    return reflection.isInstance(item, Entry1.$type);
                }

                export interface Entry2 extends langium.AstNode {
                    readonly $type: 'Entry2';
                    b1: string;
                    b2: C2;
                }

                export const Entry2 = {
                    $type: 'Entry2',
                    b1: 'b1',
                    b2: 'b2'
                } as const;

                export function isEntry2(item: unknown): item is Entry2 {
                    return reflection.isInstance(item, Entry2.$type);
                }

                export interface Entry3 extends langium.AstNode {
                    readonly $type: 'Entry3';
                    c1: string;
                    c2: C3;
                }

                export const Entry3 = {
                    $type: 'Entry3',
                    c1: 'c1',
                    c2: 'c2'
                } as const;

                export function isEntry3(item: unknown): item is Entry3 {
                    return reflection.isInstance(item, Entry3.$type);
                }
            `, expandToString`
                export const testTerminals = {
                    ...OneGrammar.Terminals,
                    ...ThreeGrammar.Terminals,
                    ...TwoGrammar.Terminals,
                };

                export type testTerminalNames = keyof typeof testTerminals;

                export type testKeywordNames = OneGrammar.KeywordNames | ThreeGrammar.KeywordNames | TwoGrammar.KeywordNames;

                export type testTokenNames = testTerminalNames | testKeywordNames;
            `
        );
    });

    test('Multi-language project: 3 languages, which depend on each other in circular way', async () => {
        await testMultiProject(
            [{
                path: 'one.langium',
                languageID: 'one',
                grammarContent: `
                    grammar OneGrammar
                    import "oneCommon";
                    import "two";
                    import "three";
                    entry Entry1: 'a' a1=ID1 (a2=C2)?;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace OneGrammar {

                            export const Terminals = {
                                ID1: /[a-z]+/,
                                WS: /\s+/,
                                ID2: /[A-Z]+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "a"
                                | "c2";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                C3: C3
                                Entry1: Entry1
                                Entry2: Entry2
                                Entry3: Entry3
                            }

                        }
                    `
                ],
            }, {
                path: 'two.langium',
                languageID: 'two',
                grammarContent: `
                    grammar TwoGrammar
                    import "twoCommon";
                    import "one";
                    import "three";
                    entry Entry2: 'b' b1=ID2 (b2=C3)?;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace TwoGrammar {

                            export const Terminals = {
                                ID2: /[A-Z]+/,
                                WS: /\s+/,
                                ID3: /[0-9]+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "b"
                                | "c3";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                C3: C3
                                Entry1: Entry1
                                Entry2: Entry2
                                Entry3: Entry3
                            }

                        }
                    `
                ],
            }, {
                path: 'three.langium',
                languageID: 'three',
                grammarContent: `
                    grammar ThreeGrammar
                    import "threeCommon";
                    import "one";
                    import "two";
                    entry Entry3: 'c' c1=ID3 (c2=C1)?;
                `,
                expectedAstContentParts: [
                    expandToString`
                        export namespace ThreeGrammar {

                            export const Terminals = {
                                ID3: /[0-9]+/,
                                ID1: /[a-z]+/,
                                WS: /\s+/,
                            };

                            export type TerminalNames = keyof typeof Terminals;

                            export type KeywordNames =
                                | "c"
                                | "c1";

                            export type TokenNames = TerminalNames | KeywordNames;

                            export type AstType = {
                                C1: C1
                                C2: C2
                                C3: C3
                                Entry1: Entry1
                                Entry2: Entry2
                                Entry3: Entry3
                            }

                        }
                    `
                ],
            }, {
                path: 'oneCommon.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID1: /[a-z]+/;
                    hidden terminal WS: /\s+/;
                    C1: 'c1' c1=ID1;
                `,
                expectedAstContentParts: [],
            }, {
                path: 'twoCommon.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID2: /[A-Z]+/;
                    C2: 'c2' c2=ID2;
                `,
                expectedAstContentParts: [],
            }, {
                path: 'threeCommon.langium',
                languageID: undefined,
                grammarContent: `
                    terminal ID3: /[0-9]+/;
                    C3: 'c3' c3=ID3;
                `,
                expectedAstContentParts: [],
            }]
        );
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
    expectedAstContentParts: Generated[];
}
async function testMultiProject(grammarFiles: GrammarFile[], ...moreExpectedParts: string[]): Promise<void> {
    // collect all information
    const config: LangiumConfig = {
        [RelativePath]: './',
        projectName: 'test',
        languages: [], // will be filled later
    };
    const documents: LangiumDocument[] = [];
    const expectedParts: string[] = [];
    const configMap: Map<Grammar, LangiumLanguageConfig> = new Map();
    for (const file of grammarFiles) {
        const grammarFile = `file:///${file.path}`;
        const uri = URI.parse(grammarFile);
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(file.grammarContent, uri);
        services.shared.workspace.LangiumDocuments.addDocument(document);
        documents.push(document);
        expectedParts.push(...file.expectedAstContentParts.map(toString));
        if (file.languageID) { // use this grammar file as entry point for a language
            const languageConfig = {
                id: file.languageID,
                grammar: grammarFile,
            };
            config.languages.push(languageConfig);
            configMap.set(document.parseResult.value as Grammar, languageConfig);
        }
    }
    expectedParts.push(...moreExpectedParts);

    // parse and build grammars
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    await documentBuilder.build(documents, { validation: true });

    // check for validation issues (only errors)
    documents.forEach(document => expectNoIssues({
        document,
        diagnostics: document.diagnostics ?? [],
        dispose: async () => {},
    }, { severity: DiagnosticSeverity.Error }));

    // generate the ast.ts
    let generated: string;
    if (configMap.size === 1) {
        generated = generateAstSingleLanguageProject(services.grammar, configMap.keys().next().value!, config);
    } else {
        const languages: LanguageInfo[] = [];
        for (const e of [...configMap.entries()]) {
            const entryGrammar = e[0];
            languages.push({
                entryGrammar,
                embeddedGrammar: undefined!,
                languageConfig: e[1],
                identifier: getLanguageIdentifier(config, entryGrammar), // the name defined after the 'grammar' keyword inside the *.langium file
            });
        }
        languages.sort((e1, e2) => e1.identifier.localeCompare(e2.identifier));
        const embeddingSuccessful = await embedGrammars(languages, config, {}, services.grammar);
        if (embeddingSuccessful !== true) {
            expect.fail();
        }
        generated = generateAstMultiLanguageProject(services.grammar, languages, config);
    }

    // check the generated content
    expectedParts.forEach(part => expect(generated).toContain(part));
}
