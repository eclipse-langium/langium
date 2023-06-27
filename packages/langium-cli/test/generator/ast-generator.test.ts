/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { Grammar } from 'langium';
import type { LangiumConfig } from '../../src/package';
import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem, expandToString, normalizeEOL } from 'langium';
import { parseHelper } from 'langium/test';
import { RelativePath } from '../../src/package';
import { generateAst } from '../../src/generator/ast-generator';

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

    test('should generate terminal names and regular expressions', async () => {
        const grammar = `
            grammar TestGrammar
                
            entry Hello:
                'Hello, ' name=ID '!';

            hidden terminal WS: /\\s+/;
            
            terminal ID: /[_a-zA-Z][\\w_]*/;
        `;
        const expected = expandToString`
            export const TerminalNames = 'WS' | 'ID';

            export const TerminalRegExps: Record<TerminalNames, RegExp> = {
                WS : /\\s+/,
                ID : /[_a-zA-Z][\\w_]*/,
            };
        `;
        const result = (await parse(grammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const expectedPart = normalizeEOL(expected).trim();
        const typesFileContent = generateAst(services.grammar, [result.value], config);

        const start = typesFileContent.indexOf('export const TerminalNames');
        const hashPosition = typesFileContent.indexOf('export const TerminalRegExps');
        const end = typesFileContent.indexOf('};', hashPosition)+2;
        const relevantPart = typesFileContent.substring(start, end).trim();
        expect(relevantPart).toEqual(expectedPart);
    });

});

function testGeneratedAst(name: string, grammar: string, expected: string): void {
    test(name, async () => {
        const result = (await parse(grammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const expectedPart = normalizeEOL(expected).trim();
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedPart);
    });
}
