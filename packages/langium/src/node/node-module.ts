/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createCommonSharedModule, createDefaultModule, DefaultSharedModuleContext } from '../default-module';
import { inject, Module } from '../dependency-injection';
import { LangiumGrammarGeneratedModule, LangiumGrammarGeneratedSharedModule } from '../grammar/generated/module';
import { LangiumGrammarModule, LangiumGrammarServices } from '../grammar/langium-grammar-module';
import { LangiumDefaultSharedServices, LangiumSharedServices } from '../services';
import { NodeFileSystemProvider } from './node-file-system-provider';

/**
 * Create a dependency injection module for the default shared services. This is the set of
 * services that are shared between multiple languages.
 *
 * This shared module is node.js specific and should only be used if you are using Langium in a node.js context.
 */
export function createDefaultSharedModule(context: DefaultSharedModuleContext = {}): Module<LangiumSharedServices, LangiumDefaultSharedServices> {
    return createCommonSharedModule({
        ...context,
        fileSystemProvider: () => new NodeFileSystemProvider()
    });
}

export function createLangiumGrammarServices(context?: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    grammar: LangiumGrammarServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        LangiumGrammarGeneratedSharedModule
    );
    const grammar = inject(
        createDefaultModule({ shared }),
        LangiumGrammarGeneratedModule,
        LangiumGrammarModule
    );
    shared.ServiceRegistry.register(grammar);
    return { shared, grammar };
}
