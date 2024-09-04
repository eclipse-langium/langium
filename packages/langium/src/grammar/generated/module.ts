/******************************************************************************
 * This file was generated by langium-cli 3.2.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import type { LanguageMetaData } from '../../languages/language-meta-data.js';
import { LangiumGrammarAstReflection } from '../../languages/generated/ast.js';
import type { Module } from '../../dependency-injection.js';
import type { LangiumSharedCoreServices, LangiumCoreServices, LangiumGeneratedCoreServices, LangiumGeneratedSharedCoreServices } from '../../services.js';
import type { IParserConfig } from '../../parser/parser-config.js';
import { LangiumGrammarGrammar } from './grammar.js';

export const LangiumGrammarLanguageMetaData = {
    languageId: 'langium',
    fileExtensions: ['.langium'],
    caseInsensitive: false
} as const satisfies LanguageMetaData;

export const LangiumGrammarParserConfig: IParserConfig = {
    maxLookahead: 3,
};

export const LangiumGrammarGeneratedSharedModule: Module<LangiumSharedCoreServices, LangiumGeneratedSharedCoreServices> = {
    AstReflection: () => new LangiumGrammarAstReflection()
};

export const LangiumGrammarGeneratedModule: Module<LangiumCoreServices, LangiumGeneratedCoreServices> = {
    Grammar: () => LangiumGrammarGrammar(),
    LanguageMetaData: () => LangiumGrammarLanguageMetaData,
    parser: {
        ParserConfig: () => LangiumGrammarParserConfig
    }
};
