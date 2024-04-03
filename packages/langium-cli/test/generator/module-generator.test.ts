/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumConfig, LangiumLanguageConfig } from '../../src/package-types.js';
import type { Grammar } from 'langium';
import { describe, expect, test } from 'vitest';
import { generateModule } from '../../src/generator/module-generator.js';
import { RelativePath } from '../../src/package-types.js';

describe('Module generator', () => {
    describe('IParserConfig inclusion', () => {
        test('should not include an import of IParserConfig', () => {
            // arrange
            const config = { projectName: 'Magic', languages: [], [RelativePath]: '/path/to/magic' };

            // act
            const moduleString = generateModule([], config, new Map());

            // assert
            expect(moduleString.includes('ParserConfig')).toBeFalsy();
        });

        test('should include an import of IParserConfig', () => {
            // arrange
            const language: LangiumLanguageConfig = {
                id: 'any',
                grammar: 'any',
                chevrotainParserConfig: { maxLookahead: 4 } //this is important!
            };
            const config: LangiumConfig = {
                projectName: 'Magic',
                languages: [language],
                [RelativePath]: '/path/to/magic',
                // chevrotainParserConfig: { maxLookahead: 4 } //chevrotain config must be not within the 'config' parameter
            };
            const grammar = <Grammar>{
                name: 'MagicGrammar'
            };
            const grammarConfigMap = new Map<Grammar, LangiumLanguageConfig>();
            grammarConfigMap.set(grammar, language);

            // act
            const moduleString = generateModule([grammar], config, grammarConfigMap);

            // assert
            expect(moduleString).toMatch('MagicGrammarParserConfig');
            expect(moduleString).toMatch(/^import .* IParserConfig/gm);
        });
    });

    describe('File extension inclusion', () => {
        test('should use empty import extension', () => {
            // arrange
            const config = {
                projectName: 'Magic',
                languages: [],
                [RelativePath]: '/path/to/magic',
                importExtension: ''
            };

            // act
            const moduleString = generateModule([], config, new Map());

            // assert
            expect(moduleString.includes("from './grammar';")).toBeTruthy();
            expect(moduleString.includes("from './ast';")).toBeTruthy();

            expect(moduleString.includes("from './grammar.js';")).toBeFalsy();
            expect(moduleString.includes("from './ast.js';")).toBeFalsy();
        });

        test('should include .js extension in imports', () => {
            // arrange
            const config: LangiumConfig = {
                projectName: 'Magic',
                languages: [],
                [RelativePath]: '/path/to/magic',
                importExtension: '.js'
            };

            // act
            const moduleString = generateModule([], config, new Map());

            // assert
            expect(moduleString.includes("from './grammar.js';")).toBeTruthy();
            expect(moduleString.includes("from './ast.js';")).toBeTruthy();

            expect(moduleString.includes("from './grammar';")).toBeFalsy();
            expect(moduleString.includes("from './ast';")).toBeFalsy();
        });
    });
});
