/******************************************************************************
 * This file was generated by langium-cli 0.2.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumSharedServices, LangiumServices, LanguageMetaData, Module } from 'langium';
import { ArithmeticsAstReflection } from './ast';
import { ArithmeticsGrammar } from './grammar';

export const ArithmeticsLanguageMetaData: LanguageMetaData = {
    languageId: 'arithmetics',
    fileExtensions: ['.calc'],
    caseInsensitive: false
};

export const ArithmeticsGeneratedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
    AstReflection: () => new ArithmeticsAstReflection()
};

export const ArithmeticsGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Grammar: () => ArithmeticsGrammar(),
    LanguageMetaData: () => ArithmeticsLanguageMetaData,
    parser: {}
};
