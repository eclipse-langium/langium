/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import type { LangiumConfig, LangiumLanguageConfig } from '../../src/package';
import type { Grammar } from 'langium';
import { describe, expect, test } from 'vitest';
import { generateModule } from '../../src/generator/module-generator';
import { RelativePath } from '../../src/package';

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
});
