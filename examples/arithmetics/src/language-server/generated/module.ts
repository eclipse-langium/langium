/******************************************************************************
 * This file was generated by langium-cli 0.1.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import { LangiumGeneratedServices, LangiumServices, LanguageMetaData, Module, defaultParserConfig } from 'langium';
import { ArithmeticsAstReflection } from './ast';
import { grammar } from './grammar';

export const languageMetaData: LanguageMetaData = {
    languageId: 'arithmetics',
    fileExtensions: ['.calc']
};

export const ArithmeticsGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Grammar: () => grammar(),
    AstReflection: () => new ArithmeticsAstReflection(),
    LanguageMetaData: () => languageMetaData,
    parser: {
        ParserConfig: () => defaultParserConfig
    }
};
