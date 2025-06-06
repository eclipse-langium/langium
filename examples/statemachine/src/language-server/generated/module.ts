/******************************************************************************
 * This file was generated by langium-cli 3.5.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import type { LangiumSharedCoreServices, LangiumCoreServices, LangiumGeneratedCoreServices, LangiumGeneratedSharedCoreServices, LanguageMetaData, Module } from 'langium';
import { StatemachineAstReflection } from './ast.js';
import { StatemachineGrammar } from './grammar.js';

export const StatemachineLanguageMetaData = {
    languageId: 'statemachine',
    fileExtensions: ['.statemachine'],
    caseInsensitive: false,
    mode: 'development'
} as const satisfies LanguageMetaData;

export const StatemachineGeneratedSharedModule: Module<LangiumSharedCoreServices, LangiumGeneratedSharedCoreServices> = {
    AstReflection: () => new StatemachineAstReflection()
};

export const StatemachineGeneratedModule: Module<LangiumCoreServices, LangiumGeneratedCoreServices> = {
    Grammar: () => StatemachineGrammar(),
    LanguageMetaData: () => StatemachineLanguageMetaData,
    parser: {}
};
