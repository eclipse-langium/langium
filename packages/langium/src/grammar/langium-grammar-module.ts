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
import { LangiumGrammarScopeComputation, LangiumScopeProvider } from './langium-grammar-scope';
import { LangiumGrammarSemanticTokenProvider } from './langium-grammar-semantic-token-provider';
import { LangiumGrammarValidationRegistry, LangiumGrammarValidator } from './langium-grammar-validator';
import { LangiumGrammarFoldingRangeProvider } from './lsp/langium-grammar-folding-range-provider';
import { LangiumGrammarFormatter } from './lsp/langium-grammar-formatter';
import { LangiumGrammarGoToResolver } from './lsp/langium-grammar-goto';
import { LangiumGrammarHoverProvider } from './lsp/langium-grammar-hover-provider';
import { LangiumGrammarReferenceFinder } from './lsp/langium-grammar-reference-finder';

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
        SemanticTokenProvider: () => new LangiumGrammarSemanticTokenProvider(),
        Formatter: () => new LangiumGrammarFormatter(),
        HoverProvider: (services) => new LangiumGrammarHoverProvider(services),
        GoToResolver: (services) => new LangiumGrammarGoToResolver(services),
        ReferenceFinder: (services) => new LangiumGrammarReferenceFinder(services)
    },
    references: {
        ScopeComputation: (services) => new LangiumGrammarScopeComputation(services),
        ScopeProvider: (services) => new LangiumScopeProvider(services)
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
