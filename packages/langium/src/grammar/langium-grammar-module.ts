/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Module } from '../dependency-injection';
import { LangiumServices, PartialLangiumServices } from '../services';
import { LangiumGrammarCodeActionProvider } from './lsp/grammar-code-actions';
import { LangiumGrammarScopeComputation, LangiumGrammarScopeProvider } from './langium-grammar-scope';
import { LangiumGrammarSemanticTokenProvider } from './lsp/grammar-semantic-tokens';
import { LangiumGrammarValidationRegistry, LangiumGrammarValidator } from './langium-grammar-validator';
import { LangiumGrammarReferenceFinder } from './lsp/grammar-reference-finder';
import { LangiumGrammarFoldingRangeProvider } from './lsp/grammar-folding-ranges';
import { LangiumGrammarFormatter } from './lsp/grammar-formatter';
import { LangiumGrammarGoToResolver } from './lsp/grammar-goto';
import { LangiumGrammarHoverProvider } from './lsp/grammar-hovers';

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
        SemanticTokenProvider: (services) => new LangiumGrammarSemanticTokenProvider(services),
        Formatter: () => new LangiumGrammarFormatter(),
        HoverProvider: (services) => new LangiumGrammarHoverProvider(services),
        GoToResolver: (services) => new LangiumGrammarGoToResolver(services),
        ReferenceFinder: (services) => new LangiumGrammarReferenceFinder(services)
    },
    references: {
        ScopeComputation: (services) => new LangiumGrammarScopeComputation(services),
        ScopeProvider: (services) => new LangiumGrammarScopeProvider(services)
    }
};
