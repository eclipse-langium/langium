/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, type Grammar } from 'langium';
import { expandToString, normalizeEOL } from 'langium/generate';
import { parseHelper } from 'langium/test';
import { createLangiumGrammarServices } from 'langium/grammar';
import { describe, expect, test } from 'vitest';
import { generateAst } from '../../src/generator/ast-generator.js';
import type { LangiumConfig } from '../../src/package-types.js';
import { RelativePath } from '../../src/package-types.js';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parse = parseHelper<Grammar>(services.grammar);

describe('Ast generator', () => {

    testGeneratedAst('should generate checker functions for datatype rules comprised of a single string', `
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
    `);

    testGeneratedAst('should generate checker functions for datatype rules comprised of a multiple strings', `
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
    `);

    testGeneratedAst('should generate checker functions for datatype rules with subtypes', `
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
    `);

    testGeneratedAst('should generate checker functions for datatype rules referencing a terminal', `
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
    `);

    testGeneratedAst('should generate checker functions for datatype rules referencing multiple terminals', `
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
    `);

    testGeneratedAst('should generate checker functions for datatype rules with nested union', `
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
    `);

    testGeneratedAst('should generate checker functions for datatype rules with repeated terminals', `
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
    `);

    testGeneratedInterface('should escape string delimiters in property type', `
        grammar TestGrammar
            
        entry Test: value="'test'";

        hidden terminal WS: /\\s+/;
    `, expandToString`
        export interface Test extends AstNode {
            readonly $type: 'Test';
            value: '\\\'test\\\'';
        }

        export const Test = 'Test';

        export function isTest(item: unknown): item is Test {
            return reflection.isInstance(item, Test);
        }
    `);

    testGeneratedAst('should generate checker functions for datatype rules of type number', `
        grammar TestGrammar

        A returns number: '1';
            
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = number;
            
        export function isA(item: unknown): item is A {
            return typeof item === 'number';
        }
    `);

    testGeneratedAst('check generated property with datatype rule of type number: single-value', `
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

        export interface Node extends AstNode {
            readonly $type: 'Node';
            num: A;
        }

        export const Node = 'Node';

        export function isNode(item: unknown): item is Node {
            return reflection.isInstance(item, Node);
        }
    `);

    testGeneratedAst('check generated property with datatype rule of type number: multi-value', `
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

        export interface Node extends AstNode {
            readonly $type: 'Node';
            num: Array<A>;
        }

        export const Node = 'Node';

        export function isNode(item: unknown): item is Node {
            return reflection.isInstance(item, Node);
        }
    `);

    testGeneratedAst('should generate checker functions for datatype rules of type boolean', `
        grammar TestGrammar

        A returns boolean: 'on';
            
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = boolean;
            
        export function isA(item: unknown): item is A {
            return typeof item === 'boolean';
        }
    `);

    testGeneratedAst('should generate checker functions for datatype rules of type bigint', `
        grammar TestGrammar

        A returns bigint: '1';
            
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = bigint;
            
        export function isA(item: unknown): item is A {
            return typeof item === 'bigint';
        }
    `);

    testGeneratedAst('should generate checker functions for datatype rules of type Date', `
        grammar TestGrammar

        A returns Date: '2023-01-01';
            
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        export type A = Date;
        
        export function isA(item: unknown): item is A {
            return item instanceof Date;
        }
    `);

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

    test('should generate terminal constants with range operator', () => testTerminalConstants(`
        grammar TestGrammar
            
        entry Amount:
            value=NUMBER;

        hidden terminal WS: /\\s+/;
        
        terminal NUMBER: '0'..'9'+;
    `, expandToString`
        export const TestTerminals = {
            WS: /\\s+/,
            NUMBER: /[0-9]+/,
        };
    `));

    test('should generate terminal constants with fragments', () => testTerminalConstants(`
        grammar TestGrammar
            
        entry Amount:
            value=NUMBER;

        hidden terminal WS: /\\s+/;
        
        terminal NUMBER: DIGIT+;
        terminal fragment DIGIT: '0'..'9';
    `, expandToString`
        export const TestTerminals = {
            WS: /\\s+/,
            NUMBER: /([0-9])+/,
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

    testTypeMetaData('should generate property metadata for super types', `
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
        getTypeMetaData(type: string): TypeMetaData {
                switch (type) {
                    case IAmArray: {
                        return {
                            name: IAmArray,
                            properties: [
                                { name: 'elements', defaultValue: [] }
                            ]
                        };
                    }
                    case DeclaredArray: {
                        return {
                            name: DeclaredArray,
                            properties: [
                                { name: 'elements', defaultValue: [] }
                            ]
                        };
                    }
                    default: {
                        return {
                            name: type,
                            properties: []
                        };
                    }
                }
            }
        }`
    );

    testTypeMetaData('should generate escaped default value', `
        grammar TestGrammar
             
        interface Test {
            value: string = "'test'";
        }
          
        Test returns Test:
            value=ID;

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `, expandToString`
        getTypeMetaData(type: string): TypeMetaData {
                switch (type) {
                    case Test: {
                        return {
                            name: Test,
                            properties: [
                                { name: 'value', defaultValue: '\\'test\\'' }
                            ]
                        };
                    }
                    default: {
                        return {
                            name: type,
                            properties: []
                        };
                    }
                }
            }
        }`
    );
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

function testGeneratedInterface(name: string, grammar: string, expected: string): void {
    testGenerated(name, grammar, expected, 'export interface', 'export type testAstType');
}

function testGeneratedAst(name: string, grammar: string, expected: string): void {
    testGenerated(name, grammar, expected, 'export type', 'export type testAstType', 3);
}

function testTypeMetaData(name: string, grammar: string, expected: string): void {
    testGenerated(name, grammar, expected, 'getTypeMetaData', 'export const reflection');
}

function testGenerated(name: string, grammar: string, expected: string, start: string, end: string, startCount = 0): void {
    test(name, async () => {
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
    });
}
