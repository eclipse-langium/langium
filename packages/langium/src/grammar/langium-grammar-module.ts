/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, DefaultSharedModuleContext } from '../default-module';
import { inject, Module } from '../dependency-injection';
import { LangiumServices, LangiumSharedServices, PartialLangiumServices } from '../services';
import { LangiumGrammarGeneratedModule, LangiumGrammarGeneratedSharedModule } from './generated/module';
import { LangiumGrammarCodeActionProvider } from './langium-grammar-code-actions';
import { LangiumGrammarScopeComputation } from './langium-grammar-scope';
import { LangiumGrammarSemanticTokenProvider } from './langium-grammar-semantic-token-provider';
import { LangiumGrammarValidationRegistry, LangiumGrammarValidator } from './langium-grammar-validator';
import { LangiumGrammarFoldingRangeProvider } from './lsp/langium-grammar-folding-range-provider';

export type LangiumGrammarAddedServices = {
    validation: {
        LangiumGrammarValidator: LangiumGrammarValidator
    }
}

export type LangiumGrammarServices = LangiumServices & LangiumGrammarAddedServices

export const LangiumGrammarModule: Module<LangiumGrammarServices, PartialLangiumServices & LangiumGrammarAddedServices> = {
    validation: {
        ValidationRegistry: (services) => new LangiumGrammarValidationRegistry(services),
        LangiumGrammarValidator: (services) => new LangiumGrammarValidator(services)
    },
    lsp: {
        FoldingRangeProvider: (services) => new LangiumGrammarFoldingRangeProvider(services),
        CodeActionProvider: () => new LangiumGrammarCodeActionProvider(),
        SemanticTokenProvider: () => new LangiumGrammarSemanticTokenProvider()
    },
    references: {
        ScopeComputation: (services) => new LangiumGrammarScopeComputation(services),
    }
};

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
