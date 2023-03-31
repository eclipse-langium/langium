/******************************************************************************
 * Copyright 2021-2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';
import { createDefaultModule, createDefaultSharedModule } from '../default-module';
import { inject, Module } from '../dependency-injection';
import { interpretAstReflection } from '../grammar/ast-reflection-interpreter';
import type { Grammar } from '../grammar/generated/ast';
import { createLangiumGrammarServices, LangiumGrammarServices } from '../grammar/langium-grammar-module';
import { LanguageMetaData } from '../grammar/language-meta-data';
import { IParserConfig } from '../parser/parser-config';
import { LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumServices, LangiumSharedServices, PartialLangiumServices, PartialLangiumSharedServices } from '../services';
import { EmptyFileSystem } from '../workspace/file-system-provider';
import { getDocument } from './ast-util';

/**
 * Create an instance of the language services for the given grammar. This function is very
 * useful when the grammar is defined on-the-fly, for example in tests of the Langium framework.
 */
export async function createServicesForGrammar(config: {
    grammar: string | Grammar,
    grammarServices?: LangiumGrammarServices,
    parserConfig?: IParserConfig,
    languageMetaData?: LanguageMetaData,
    module?: Module<LangiumServices, PartialLangiumServices>
    sharedModule?: Module<LangiumSharedServices, PartialLangiumSharedServices>
}): Promise<LangiumServices> {
    const grammarServices = config.grammarServices ?? createLangiumGrammarServices(EmptyFileSystem).grammar;
    const uri = URI.parse('memory:///grammar.langium');
    const factory = grammarServices.shared.workspace.LangiumDocumentFactory;
    const grammarDocument = typeof config.grammar === 'string'
        ? factory.fromString(config.grammar, uri)
        : getDocument(config.grammar);
    const grammarNode = grammarDocument.parseResult.value as Grammar;
    const documentBuilder = grammarServices.shared.workspace.DocumentBuilder;
    await documentBuilder.build([grammarDocument], { validationChecks: 'none' });

    const parserConfig = config.parserConfig ?? {
        skipValidations: false
    };
    const languageMetaData = config.languageMetaData ?? {
        caseInsensitive: false,
        fileExtensions: [`.${grammarNode.name?.toLowerCase() ?? 'unknown'}`],
        languageId: grammarNode.name ?? 'UNKNOWN'
    };
    const generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
        AstReflection: () => interpretAstReflection(grammarNode),
    };
    const generatedModule: Module<LangiumServices, LangiumGeneratedServices> = {
        Grammar: () => grammarNode,
        LanguageMetaData: () => languageMetaData,
        parser: {
            ParserConfig: () => parserConfig
        }
    };
    const shared = inject(createDefaultSharedModule(EmptyFileSystem), generatedSharedModule, config.sharedModule);
    const services = inject(createDefaultModule({ shared }), generatedModule, config.module);
    shared.ServiceRegistry.register(services);
    return services;
}
