/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Module } from '../dependency-injection';
import { LangiumGrammarValidationRegistry, LangiumGrammarValidator } from './langium-grammar-validator';
import { PartialLangiumServices, LangiumServices, LangiumSharedServices } from '../services';
import { SharedModuleContext } from '../default-module';
import { LangiumGrammarGeneratedModule, LangiumGrammarGeneratedSharedModule } from './generated/module';
import { LangiumGrammarFoldingRangeProvider } from './lsp/langium-grammar-folding-range-provider';
import { LangiumGrammarCodeActionProvider } from './langium-grammar-code-actions';
import { createSharedModule, injectService } from '..';

export type LangiumGrammarAddedServices = {
    validation: {
        LangiumGrammarValidator: LangiumGrammarValidator
    }
}

export type LangiumGrammarServices = LangiumServices & LangiumGrammarAddedServices

export const LangiumGrammarModule: Module<LangiumGrammarServices, PartialLangiumServices & LangiumGrammarAddedServices> = {
    validation: {
        ValidationRegistry: (injector) => new LangiumGrammarValidationRegistry(injector),
        LangiumGrammarValidator: (injector) => new LangiumGrammarValidator(injector)
    },
    lsp: {
        FoldingRangeProvider: (injector) => new LangiumGrammarFoldingRangeProvider(injector),
        CodeActionProvider: () => new LangiumGrammarCodeActionProvider()
    }
};

export function createLangiumGrammarServices(context?: SharedModuleContext): LangiumSharedServices {
    return injectService(createSharedModule(context), LangiumGrammarGeneratedSharedModule, {
        generated: LangiumGrammarGeneratedModule,
        module: LangiumGrammarModule
    });
}
