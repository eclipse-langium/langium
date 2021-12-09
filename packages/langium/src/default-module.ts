/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments } from 'vscode-languageserver';
import { inject, Module } from './dependency-injection';
import { DefaultLangiumDocumentFactory, DefaultLangiumDocuments, DefaultTextDocumentFactory } from './documents/document';
import { DefaultDocumentBuilder } from './documents/document-builder';
import { createGrammarConfig } from './grammar/grammar-config';
import { DefaultAstNodeDescriptionProvider, DefaultReferenceDescriptionProvider } from './index/ast-descriptions';
import { DefaultAstNodeLocator } from './index/ast-node-locator';
import { DefaultIndexManager } from './index/index-manager';
import { DefaultCompletionProvider } from './lsp/completion/completion-provider';
import { RuleInterpreter } from './lsp/completion/rule-interpreter';
import { DefaultDocumentHighlighter } from './lsp/document-highlighter';
import { DefaultDocumentSymbolProvider } from './lsp/document-symbol-provider';
import { DefaultFoldingRangeProvider } from './lsp/folding-range-provider';
import { DefaultGoToResolverProvider } from './lsp/goto';
import { MultilineCommentHoverProvider } from './lsp/hover-provider';
import { DefaultReferenceFinder } from './lsp/reference-finder';
import { DefaultRenameHandler } from './lsp/rename-refactoring';
import { createLangiumParser } from './parser/langium-parser-builder';
import { DefaultTokenBuilder } from './parser/token-builder';
import { DefaultValueConverter } from './parser/value-converter';
import { DefaultLinker } from './references/linker';
import { DefaultNameProvider } from './references/naming';
import { DefaultReferences } from './references/references';
import { DefaultScopeComputation, DefaultScopeProvider } from './references/scope';
import { DefaultJsonSerializer } from './serializer/json-serializer';
import { LangiumDefaultServices, LangiumDefaultSharedServices, LangiumGeneratedServices, LangiumGeneratedSharedServices, LangiumServices, LangiumSharedServices } from './services';
import { DefaultDocumentValidator } from './validation/document-validator';
import { ValidationRegistry } from './validation/validation-registry';
import { createSingleServiceRegistry, ExtensionServiceRegistry } from './service-registry';

export interface SharedModuleContext {
    connection?: Connection
}

export interface CombinedServices {
    generated: Module<LangiumServices, LangiumGeneratedServices>
    module: Module<LangiumServices, unknown>
}

export function injectService(
    sharedModule: Module<LangiumSharedServices, LangiumDefaultSharedServices>,
    generatedSharedModule: Module<LangiumSharedServices, LangiumGeneratedSharedServices>,
    ...combinedServices: CombinedServices[]): LangiumSharedServices {
    const shared = inject(sharedModule, generatedSharedModule);
    if (combinedServices.length === 1) {
        const module = combinedServices[0];
        const single = inject(createDefaultModule(shared), module.generated, module.module);
        shared.ServiceRegistry = createSingleServiceRegistry(single);
    } else if (combinedServices.length > 1) {
        const registry = new ExtensionServiceRegistry();
        shared.ServiceRegistry = registry;
        const defaultModule = createDefaultModule(shared);
        for (const combinedService of combinedServices) {
            const service = inject(defaultModule, combinedService.generated, combinedService.module);
            for (const fileExtension of service.LanguageMetaData.fileExtensions) {
                registry.add(fileExtension, service);
            }
        }
    }
    return shared;
}

export function createSharedModule(context: SharedModuleContext = {}): Module<LangiumSharedServices, LangiumDefaultSharedServices> {
    return {
        ServiceRegistry: () => undefined!,
        lsp: {
            Connection: () => context.connection
        },
        workspace: {
            LangiumDocuments: (injector) => new DefaultLangiumDocuments(injector),
            LangiumDocumentFactory: (injector) => new DefaultLangiumDocumentFactory(injector),
            DocumentBuilder: (injector) => new DefaultDocumentBuilder(injector),
            TextDocuments: () => new TextDocuments(TextDocument),
            TextDocumentFactory: (injector) => new DefaultTextDocumentFactory(injector),
            IndexManager: (injector) => new DefaultIndexManager(injector)
        }
    };
}

export function createDefaultModule(shared: LangiumSharedServices): Module<LangiumServices, LangiumDefaultServices> {
    return {
        parser: {
            GrammarConfig: (injector) => createGrammarConfig(injector),
            LangiumParser: (injector) => createLangiumParser(injector),
            ValueConverter: () => new DefaultValueConverter(),
            TokenBuilder: () => new DefaultTokenBuilder()
        },
        lsp: {
            completion: {
                CompletionProvider: (injector) => new DefaultCompletionProvider(injector),
                RuleInterpreter: () => new RuleInterpreter()
            },
            DocumentSymbolProvider: (injector) => new DefaultDocumentSymbolProvider(injector),
            HoverProvider: (injector) => new MultilineCommentHoverProvider(injector),
            FoldingRangeProvider: (injector) => new DefaultFoldingRangeProvider(injector),
            ReferenceFinder: (injector) => new DefaultReferenceFinder(injector),
            GoToResolver: (injector) => new DefaultGoToResolverProvider(injector),
            DocumentHighlighter: (injector) => new DefaultDocumentHighlighter(injector),
            RenameHandler: (injector) => new DefaultRenameHandler(injector)
        },
        index: {
            AstNodeLocator: () => new DefaultAstNodeLocator(),
            AstNodeDescriptionProvider: (injector) => new DefaultAstNodeDescriptionProvider(injector),
            ReferenceDescriptionProvider: (injector) => new DefaultReferenceDescriptionProvider(injector)
        },
        references: {
            Linker: (injector) => new DefaultLinker(injector),
            NameProvider: () => new DefaultNameProvider(),
            ScopeProvider: (injector) => new DefaultScopeProvider(injector),
            ScopeComputation: (injector) => new DefaultScopeComputation(injector),
            References: (injector) => new DefaultReferences(injector)
        },
        serializer: {
            JsonSerializer: (injector) => new DefaultJsonSerializer(injector)
        },
        validation: {
            DocumentValidator: (injector) => new DefaultDocumentValidator(injector),
            ValidationRegistry: (injector) => new ValidationRegistry(injector)
        },
        shared: () => shared
    };
}
