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
import { EmptyFileSystemProvider } from '../workspace/file-system-provider';

/**
 * Create a dependency injection module for the default shared services. This is the set of
 * services that are shared between multiple languages.
 *
 * This shared service module is runtime independent and can be used for both browser and node.js runtimes.
 * Be aware that it has no access to any node.js APIs such as the file system API.
 */
export function createDefaultSharedModule(context: DefaultSharedModuleContext = {}): Module<LangiumSharedServices, LangiumDefaultSharedServices> {
    return createCommonSharedModule({
        ...context,
        fileSystemProvider: () => new EmptyFileSystemProvider()
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
