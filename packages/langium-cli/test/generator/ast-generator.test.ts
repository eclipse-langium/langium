/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem, expandToString, Grammar, normalizeEOL } from 'langium';
import { parseHelper } from 'langium/test';
import { LangiumConfig, RelativePath } from '../../src/package';
import { generateAst } from '../../src/generator/ast-generator';

const services = createLangiumGrammarServices(EmptyFileSystem);

describe('Ast generator', () => {

    test('should generate checker functions for datatype rules comprised of a single string', async () => {
        const testGrammar = `
            grammar TestGrammar
            
            A returns string:
                'a';

            hidden terminal WS: /\\s+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
            hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = 'a';
       
       export function isA(item: unknown): item is A {
           return item === 'a';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules comprised of a multiple strings', async () => {
        const testGrammar = `
            grammar TestGrammar
            
            A returns string:
                'a' | 'b' | 'c';

            hidden terminal WS: /\\s+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
            hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = 'a' | 'b' | 'c';
       
       export function isA(item: unknown): item is A {
           return item === 'a' || item === 'b' || item === 'c';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules with subtypes', async () => {
        const testGrammar = `
            grammar TestGrammar
            
            A returns string:
                'a';

            AB returns string:
                A | 'b';

            hidden terminal WS: /\\s+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
            hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = 'a';
       
       export function isA(item: unknown): item is A {
           return item === 'a';
       }
       
       export type AB = 'b' | A;

       export function isAB(item: unknown): item is AB {
           return isA(item) || item === 'b';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules referencing a terminal', async () => {
        const testGrammar = `
            grammar TestGrammar
            
            A returns string:
                ID;

            hidden terminal WS: /\\s+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
            hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = string;
       
       export function isA(item: string): item is A {
           return /[_a-zA-Z][\\w_]*/.test(item);
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules with nested union', async () => {
        const testGrammar = `
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
            hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
            hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;
        const expectedASTFile = normalizeEOL(expandToString`
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
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules with recursive terminals', async () => {
        const testGrammar = `
            grammar TestGrammar
            
            A returns string:
                ID ('.' ID)*;

            hidden terminal WS: /\\s+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
            hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = string;
       
       export function isA(item: unknown): item is A {
           return typeof item === 'string';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules of type number', async () => {
        const testGrammar = `
        grammar TestGrammar

        A returns number: '1';
        
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        hidden terminal SL_COMMENT: /\\/\\/[^\n\r]*/;
        
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = number;
       
       export function isA(item: unknown): item is A {
           return typeof item === 'number';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules of type boolean', async () => {
        const testGrammar = `
        grammar TestGrammar

        A returns boolean: 'on';
        
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        hidden terminal SL_COMMENT: /\\/\\/[^\n\r]*/;
        
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = boolean;
       
       export function isA(item: unknown): item is A {
           return typeof item === 'boolean';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules of type bigint', async () => {
        const testGrammar = `
        grammar TestGrammar

        A returns bigint: '1';
        
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        hidden terminal SL_COMMENT: /\\/\\/[^\n\r]*/;
        
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = bigint;
       
       export function isA(item: unknown): item is A {
           return typeof item === 'bigint';
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

    test('should generate checker functions for datatype rules of type Date', async () => {
        const testGrammar = `
        grammar TestGrammar

        A returns Date: '2023-01-01';
        
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        hidden terminal SL_COMMENT: /\\/\\/[^\n\r]*/;
        
        `;
        const expectedASTFile = normalizeEOL(expandToString`
       export type A = Date;
       
       export function isA(item: unknown): item is A {
           return item instanceof Date;
       }
       `).trim();
        const result = (await parseHelper<Grammar>(services.grammar)(testGrammar)).parseResult;
        const config: LangiumConfig = {
            [RelativePath]: './',
            projectName: 'test',
            languages: []
        };
        const typesFileContent = generateAst(services.grammar, [result.value], config);
        const relevantPart = typesFileContent.substring(typesFileContent.indexOf('export'), typesFileContent.indexOf('export type testAstType')).trim();
        expect(relevantPart).toEqual(expectedASTFile);
    });

});
