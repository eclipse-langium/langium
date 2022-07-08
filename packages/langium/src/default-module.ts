/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Connection, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Module } from 'inject';
import { createGrammarConfig } from './grammar/grammar-config';
import { MultilineCommentHoverProvider } from './lsp';
import { DefaultCompletionProvider } from './lsp/completion/completion-provider';
import { RuleInterpreter } from './lsp/completion/rule-interpreter';
import { DefaultDocumentHighlighter } from './lsp/document-highlighter';
import { DefaultDocumentSymbolProvider } from './lsp/document-symbol-provider';
import { DefaultFoldingRangeProvider } from './lsp/folding-range-provider';
import { DefaultGoToResolverProvider } from './lsp/goto';
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
import { MutexLock } from './utils/promise-util';
import { DefaultDocumentValidator } from './validation/document-validator';
import { ValidationRegistry } from './validation/validation-registry';
import { DefaultAstNodeDescriptionProvider, DefaultReferenceDescriptionProvider } from './workspace/ast-descriptions';
import { DefaultAstNodeLocator } from './workspace/ast-node-locator';
import { DefaultDocumentBuilder } from './workspace/document-builder';
import { DefaultLangiumDocumentFactory, DefaultLangiumDocuments, DefaultTextDocumentFactory } from './workspace/documents';
import { FileSystemProvider } from './workspace/file-system-provider';
import { DefaultIndexManager } from './workspace/index-manager';
import { DefaultWorkspaceManager } from './workspace/workspace-manager';

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
            GrammarConfig: (services) => createGrammarConfig(services),
            LangiumParser: (services) => createLangiumParser(services),
            ValueConverter: () => new DefaultValueConverter(),
            TokenBuilder: () => new DefaultTokenBuilder()
        },
        lsp: {
            completion: {
                CompletionProvider: (services) => new DefaultCompletionProvider(services),
                RuleInterpreter: () => new RuleInterpreter()
            },
            DocumentSymbolProvider: (services) => new DefaultDocumentSymbolProvider(services),
            HoverProvider: (services) => new MultilineCommentHoverProvider(services),
            FoldingRangeProvider: (services) => new DefaultFoldingRangeProvider(services),
            ReferenceFinder: (services) => new DefaultReferenceFinder(services),
            GoToResolver: (services) => new DefaultGoToResolverProvider(services),
            DocumentHighlighter: (services) => new DefaultDocumentHighlighter(services),
            RenameHandler: (services) => new DefaultRenameHandler(services)
        },
        workspace: {
            AstNodeLocator: () => new DefaultAstNodeLocator(),
            AstNodeDescriptionProvider: (services) => new DefaultAstNodeDescriptionProvider(services),
            ReferenceDescriptionProvider: (services) => new DefaultReferenceDescriptionProvider(services)
        },
        references: {
            Linker: (services) => new DefaultLinker(services),
            NameProvider: () => new DefaultNameProvider(),
            ScopeProvider: (services) => new DefaultScopeProvider(services),
            ScopeComputation: (services) => new DefaultScopeComputation(services),
            References: (services) => new DefaultReferences(services)
        },
        serializer: {
            JsonSerializer: (services) => new DefaultJsonSerializer(services)
        },
        validation: {
            DocumentValidator: (services) => new DefaultDocumentValidator(services),
            ValidationRegistry: (services) => new ValidationRegistry(services)
        },
        shared: () => context.shared
    };
}

/**
 * Context required for creating the default shared dependency injection module.
 */
export interface DefaultSharedModuleContext {
    /**
     * Represents an abstract language server connection
     */
    connection?: Connection;
    /**
     * Factory function to create a {@link FileSystemProvider}.
     *
     * Langium exposes an `EmptyFileSystem` and `NodeFileSystem`, exported through `langium/node`.
     * When running Langium as part of a vscode language server or a Node.js app, using the `NodeFileSystem` is recommended,
     * the `EmptyFileSystem` in every other use case.
     */
    fileSystemProvider: (services: LangiumSharedServices) => FileSystemProvider;
}

/**
 * Create a dependency injection module for the default shared services. This is the set of
 * services that are shared between multiple languages.
 */
export function createDefaultSharedModule(context: DefaultSharedModuleContext): Module<LangiumSharedServices, LangiumDefaultSharedServices> {
    return {
        ServiceRegistry: () => new DefaultServiceRegistry(),
        lsp: {
            Connection: () => context.connection
        },
        workspace: {
            LangiumDocuments: (services) => new DefaultLangiumDocuments(services),
            LangiumDocumentFactory: (services) => new DefaultLangiumDocumentFactory(services),
            DocumentBuilder: (services) => new DefaultDocumentBuilder(services),
            TextDocuments: () => new TextDocuments(TextDocument),
            TextDocumentFactory: (services) => new DefaultTextDocumentFactory(services),
            IndexManager: (services) => new DefaultIndexManager(services),
            WorkspaceManager: (services) => new DefaultWorkspaceManager(services),
            FileSystemProvider: (services) => context.fileSystemProvider(services),
            MutexLock: () => new MutexLock()
        }
    };
}
