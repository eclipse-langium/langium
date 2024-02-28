/******************************************************************************
 * This file was generated by langium-cli 3.0.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import type { LangiumGeneratedCoreServices, LangiumGeneratedSharedCoreServices, LanguageMetaData, Module } from 'langium';
import type { LangiumSharedServices, LangiumServices } from 'langium/lsp';
import { StatemachineAstReflection } from './ast.js';
import { StatemachineGrammar } from './grammar.js';

export const StatemachineLanguageMetaData = {
    languageId: 'statemachine',
    fileExtensions: ['.statemachine'],
    caseInsensitive: false
} as const satisfies LanguageMetaData;

export const StatemachineGeneratedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedCoreServices> = {
    AstReflection: () => new StatemachineAstReflection()
};

export const StatemachineGeneratedModule: Module<LangiumServices, LangiumGeneratedCoreServices> = {
    Grammar: () => StatemachineGrammar(),
    LanguageMetaData: () => StatemachineLanguageMetaData,
    parser: {}
};
