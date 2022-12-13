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
import { LangiumGrammarValidationRegistry, LangiumGrammarValidator } from './validation/validator';
import { LangiumGrammarCodeActionProvider } from './lsp/grammar-code-actions';
import { LangiumGrammarFoldingRangeProvider } from './lsp/grammar-folding-ranges';
import { LangiumGrammarFormatter } from './lsp/grammar-formatter';
import { LangiumGrammarSemanticTokenProvider } from './lsp/grammar-semantic-tokens';
import { LangiumGrammarNameProvider } from './references/grammar-naming';
import { LangiumGrammarReferences } from './references/grammar-references';
import { LangiumGrammarDefinitionProvider } from './lsp/grammar-definition';
import { LangiumGrammarCallHierarchyProvider } from './lsp/grammar-call-hierarchy';
import { LangiumGrammarValidationResourcesCollector } from './validation/validation-resources-collector';
import { LangiumGrammarTypesValidator } from './validation/types-validator';
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
        ValidationRegistry: (services) => new LangiumGrammarValidationRegistry(services),
        LangiumGrammarValidator: (services) => new LangiumGrammarValidator(services),
        ValidationResourcesCollector: () => new LangiumGrammarValidationResourcesCollector(),
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
    addTypeCollectionPhase(shared);
    const grammar = inject(
        createDefaultModule({ shared }),
        LangiumGrammarGeneratedModule,
        LangiumGrammarModule
    );
    shared.ServiceRegistry.register(grammar);
    return { shared, grammar };
}

function addTypeCollectionPhase(services: LangiumSharedServices) {
    const documentBuilder = services.workspace.DocumentBuilder;
    const langiumDocuments = services.workspace.LangiumDocuments;
    const serviceRegistry = services.ServiceRegistry;

    documentBuilder.onBuildPhase(DocumentState.IndexedReferences, async (documents, cancelToken) => {
        documents.forEach(async document => {
            await interruptAndCheck(cancelToken);
            const docServices = serviceRegistry.getServices(document.uri) as LangiumGrammarServices;
            const typeCollector = docServices.validation.ValidationResourcesCollector;
            const grammar = document.parseResult.value as Grammar;
            (document as LangiumGrammarDocument).validationResources = typeCollector.collectValidationResources(grammar, langiumDocuments);
        });
    });
}
