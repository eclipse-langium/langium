/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    createDefaultModule, createLangiumParser, Grammar, inject, IParserConfig, LangiumGeneratedServices,
    LangiumServices, Module
} from 'langium';
import { LangiumConfig } from './package';

export function validateParser(grammar: Grammar, config: LangiumConfig): Error | undefined {
    const parserConfig: IParserConfig = {
        ...config.chevrotainParserConfig,
        skipValidations: false
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unavailable: () => any = () => ({});
    const generatedModule: Module<LangiumServices, LangiumGeneratedServices> = {
        Grammar: () => grammar,
        AstReflection: unavailable,
        LanguageMetaData: unavailable,
        parser: {
            ParserConfig: () => parserConfig
        }
    };
    const services = inject(createDefaultModule({}), generatedModule);
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
