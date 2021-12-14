/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    createDefaultModule, createDefaultSharedModule, createLangiumParser, Grammar, inject,
    IParserConfig, LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumServices,
    LangiumSharedServices, Module
} from 'langium';
import { LangiumConfig } from './package';

export function validateParser(grammar: Grammar, config: LangiumConfig): Error | undefined {
    const parserConfig: IParserConfig = {
        ...config.chevrotainParserConfig,
        skipValidations: false
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unavailable: () => any = () => ({});
    const generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices> = {
        AstReflection: unavailable,
    };
    const generatedModule: Module<LangiumServices, LangiumGeneratedServices> = {
        Grammar: () => grammar,
        LanguageMetaData: unavailable,
        parser: {
            ParserConfig: () => parserConfig
        }
    };
    const shared = inject(createDefaultSharedModule(), generatedSharedModule);
    const services = inject(createDefaultModule({ shared }), generatedModule);
    try {
        createLangiumParser(services);
        return undefined;
    } catch (err) {
        if (err instanceof Error) {
            return err;
        }
        throw err;
    }
}
