/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, DefaultSharedModuleContext } from '../default-module';
import { inject, Module } from '../dependency-injection';
import { LangiumServices, LangiumSharedServices, PartialLangiumServices, PartialLangiumSharedServices } from '../services';
import { LangiumGrammarGeneratedModule, LangiumGrammarGeneratedSharedModule } from './generated/module';
import { LangiumGrammarScopeComputation, LangiumGrammarScopeProvider } from './references/grammar-scope';
import { LangiumGrammarValidator, registerValidationChecks } from './validation/validator';
import { LangiumGrammarCodeActionProvider } from './lsp/grammar-code-actions';
import { LangiumGrammarFoldingRangeProvider } from './lsp/grammar-folding-ranges';
import { LangiumGrammarFormatter } from './lsp/grammar-formatter';
import { LangiumGrammarSemanticTokenProvider } from './lsp/grammar-semantic-tokens';
import { LangiumGrammarNameProvider } from './references/grammar-naming';
import { LangiumGrammarReferences } from './references/grammar-references';
import { LangiumGrammarDefinitionProvider } from './lsp/grammar-definition';
import { LangiumGrammarCallHierarchyProvider } from './lsp/grammar-call-hierarchy';
import { LangiumGrammarValidationResourcesCollector } from './validation/validation-resources-collector';
import { LangiumGrammarTypesValidator, registerTypeValidationChecks } from './validation/types-validator';
import { LangiumGrammarDocument } from './workspace/documents';
import { Grammar } from './generated/ast';
import { interruptAndCheck } from '../utils/promise-util';
import { DocumentState } from '../workspace/documents';

export type LangiumGrammarAddedServices = {
    validation: {
        LangiumGrammarValidator: LangiumGrammarValidator,
        ValidationResourcesCollector: LangiumGrammarValidationResourcesCollector,
        LangiumGrammarTypesValidator: LangiumGrammarTypesValidator,
    }
}

export type LangiumGrammarServices = LangiumServices & LangiumGrammarAddedServices;

export const LangiumGrammarModule: Module<LangiumGrammarServices, PartialLangiumServices & LangiumGrammarAddedServices> = {
    validation: {
        LangiumGrammarValidator: (services) => new LangiumGrammarValidator(services),
        ValidationResourcesCollector: (services) => new LangiumGrammarValidationResourcesCollector(services),
        LangiumGrammarTypesValidator: () => new LangiumGrammarTypesValidator(),
    },
    lsp: {
        FoldingRangeProvider: (services) => new LangiumGrammarFoldingRangeProvider(services),
        CodeActionProvider: (services) => new LangiumGrammarCodeActionProvider(services),
        SemanticTokenProvider: (services) => new LangiumGrammarSemanticTokenProvider(services),
        Formatter: () => new LangiumGrammarFormatter(),
        DefinitionProvider: (services) => new LangiumGrammarDefinitionProvider(services),
        CallHierarchyProvider: (services) => new LangiumGrammarCallHierarchyProvider(services)
    },
    references: {
        ScopeComputation: (services) => new LangiumGrammarScopeComputation(services),
        ScopeProvider: (services) => new LangiumGrammarScopeProvider(services),
        References: (services) => new LangiumGrammarReferences(services),
        NameProvider: () => new LangiumGrammarNameProvider()
    }
};

export function createLangiumGrammarServices(context: DefaultSharedModuleContext,
    sharedModule?: Module<LangiumSharedServices, PartialLangiumSharedServices>): {
        shared: LangiumSharedServices,
        grammar: LangiumGrammarServices
    } {
    const shared = inject(
        createDefaultSharedModule(context),
        LangiumGrammarGeneratedSharedModule,
        sharedModule
    );
    const grammar = inject(
        createDefaultModule({ shared }),
        LangiumGrammarGeneratedModule,
        LangiumGrammarModule
    );
    addTypeCollectionPhase(shared, grammar);
    shared.ServiceRegistry.register(grammar);

    registerValidationChecks(grammar);
    registerTypeValidationChecks(grammar);

    return { shared, grammar };
}

function addTypeCollectionPhase(sharedServices: LangiumSharedServices, grammarServices: LangiumGrammarServices) {
    const documentBuilder = sharedServices.workspace.DocumentBuilder;
    documentBuilder.onBuildPhase(DocumentState.IndexedReferences, async (documents, cancelToken) => {
        for (const document of documents) {
            await interruptAndCheck(cancelToken);
            const typeCollector = grammarServices.validation.ValidationResourcesCollector;
            const grammar = document.parseResult.value as Grammar;
            (document as LangiumGrammarDocument).validationResources = typeCollector.collectValidationResources(grammar);
        }
    });
}
