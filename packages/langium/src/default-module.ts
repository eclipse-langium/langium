/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments } from 'vscode-languageserver';
import { Module } from './dependency-injection';
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
import { LangiumDefaultServices, LangiumServices } from './services';
import { DefaultDocumentValidator } from './validation/document-validator';
import { ValidationRegistry } from './validation/validation-registry';

export type DefaultModuleContext = {
    connection?: Connection
}

export function createDefaultModule(context: DefaultModuleContext = {}): Module<LangiumServices, LangiumDefaultServices> {
    return {
        parser: {
            GrammarConfig: (injector) => createGrammarConfig(injector),
            LangiumParser: (injector) => createLangiumParser(injector),
            ValueConverter: () => new DefaultValueConverter(),
            TokenBuilder: () => new DefaultTokenBuilder()
        },
        documents: {
            LangiumDocuments: (injector) => new DefaultLangiumDocuments(injector),
            LangiumDocumentFactory: (injector) => new DefaultLangiumDocumentFactory(injector),
            DocumentBuilder: (injector) => new DefaultDocumentBuilder(injector),
            TextDocuments: () => new TextDocuments(TextDocument),
            TextDocumentFactory: (injector) => new DefaultTextDocumentFactory(injector),
        },
        lsp: {
            completion: {
                CompletionProvider: (injector) => new DefaultCompletionProvider(injector),
                RuleInterpreter: () => new RuleInterpreter()
            },
            Connection: () => context.connection,
            DocumentSymbolProvider: (injector) => new DefaultDocumentSymbolProvider(injector),
            HoverProvider: (injector) => new MultilineCommentHoverProvider(injector),
            FoldingRangeProvider: (injector) => new DefaultFoldingRangeProvider(injector),
            ReferenceFinder: (injector) => new DefaultReferenceFinder(injector),
            GoToResolver: (injector) => new DefaultGoToResolverProvider(injector),
            DocumentHighlighter: (injector) => new DefaultDocumentHighlighter(injector),
            RenameHandler: (injector) => new DefaultRenameHandler(injector)
        },
        index: {
            IndexManager: (injector) => new DefaultIndexManager(injector),
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
        }
    };
}
