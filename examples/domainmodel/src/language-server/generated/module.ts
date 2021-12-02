/******************************************************************************
 * This file was generated by langium-cli 0.2.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumSharedServices, LangiumServices, LanguageMetaData, Module, IParserConfig } from 'langium';
import { DomainModelAstReflection } from './ast';
import { DomainModelGrammar } from './grammar';

export const DomainModelLanguageMetaData: LanguageMetaData = {
    languageId: 'domain-model',
    fileExtensions: ['.dmodel'],
    caseInsensitive: false
};

export const parserConfig: IParserConfig = {
    recoveryEnabled: true,
    nodeLocationTracking: 'full',
    maxLookahead: 3,
};

export const DomainModelGeneratedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
    AstReflection: () => new DomainModelAstReflection()
};

export const DomainModelGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Grammar: () => DomainModelGrammar(),
    LanguageMetaData: () => DomainModelLanguageMetaData,
    parser: {
        ParserConfig: () => parserConfig
    }
};
