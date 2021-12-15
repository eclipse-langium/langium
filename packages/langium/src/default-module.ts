/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Connection, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Module } from './dependency-injection';
import { createGrammarConfig } from './grammar/grammar-config';
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
import { DefaultServiceRegistry } from './service-registry';
import { LangiumDefaultServices, LangiumDefaultSharedServices, LangiumServices, LangiumSharedServices } from './services';
import { DefaultDocumentValidator } from './validation/document-validator';
import { ValidationRegistry } from './validation/validation-registry';
import { DefaultAstNodeDescriptionProvider, DefaultReferenceDescriptionProvider } from './workspace/ast-descriptions';
import { DefaultAstNodeLocator } from './workspace/ast-node-locator';
import { DefaultDocumentBuilder } from './workspace/document-builder';
import { DefaultLangiumDocumentFactory, DefaultLangiumDocuments, DefaultTextDocumentFactory } from './workspace/documents';
import { DefaultIndexManager } from './workspace/index-manager';

/**
 * Context required for creating the default language-specific dependency injection module.
 */
export interface DefaultModuleContext {
    shared: LangiumSharedServices;
}

/**
 * Create a dependency injection module for the default language-specific services. This is a
 * set of services that are used by exactly one language.
 */
export function createDefaultModule(context: DefaultModuleContext): Module<LangiumServices, LangiumDefaultServices> {
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
        shared: () => context.shared
    };
}

/**
 * Context required for creating the default shared dependeny injection module.
 */
export interface DefaultSharedModuleContext {
    connection?: Connection;
}

/**
 * Create a dependency injection module for the default shared services. This is the set of
 * services that are shared between multiple languages.
 */
export function createDefaultSharedModule(context: DefaultSharedModuleContext = {}): Module<LangiumSharedServices, LangiumDefaultSharedServices> {
    return {
        ServiceRegistry: () => new DefaultServiceRegistry(),
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
