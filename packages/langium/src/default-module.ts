/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Module } from './dependency-injection';
import { LangiumServices } from './services';
import { LangiumDocumentConfiguration } from './documents/document';
import { DefaultDocumentBuilder } from './documents/document-builder';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { DefaultLinker } from './references/linker';
import { DefaultScopeComputation, DefaultScopeProvider } from './references/scope';
import { DefaultNameProvider } from './references/naming';
import { ValidationRegistry } from './service/validation/validation-registry';
import { DefaultDocumentValidator } from './service/validation/document-validator';
import { DefaultJsonSerializer } from './serializer/json-serializer';
import { DefaultDocumentSymbolProvider } from './service/symbols/document-symbol-provider';
import { DefaultCompletionProvider } from './service/completion/completion-provider';
import { RuleInterpreter } from './service/completion/rule-interpreter';
import { DefaultValueConverter } from './parser/value-converter';
import { DefaultReferenceFinder } from './references/reference-finder';
import { DefaultGoToResolverProvider } from './references/goto';
import { DefaultDocumentHighlighter } from './references/document-highlighter';
import { DefaultReferences } from './references/references';

export type DefaultModuleContext = {
    connection?: Connection
}

export function createDefaultModule(context: DefaultModuleContext = {}): Module<LangiumServices> {
    return {
        Parser: () => {
            throw new Error('Not implemented'); // TODO more helpful error message
        },
        GrammarAccess: () => {
            throw new Error('Not implemented'); // TODO more helpful error message
        },
        AstReflection: () => {
            throw new Error('Not implemented'); // TODO more helpful error message
        },

        parser: {
            ValueConverter: () => new DefaultValueConverter()
        },
        documents: {
            DocumentBuilder: (injector) => new DefaultDocumentBuilder(injector),
            TextDocuments: () => new TextDocuments(LangiumDocumentConfiguration)
        },
        languageServer: {
            Connection: () => context.connection
        },
        references: {
            Linker: (injector) => new DefaultLinker(injector),
            NameProvider: () => new DefaultNameProvider(),
            ScopeProvider: (injector) => new DefaultScopeProvider(injector),
            ScopeComputation: (injector) => new DefaultScopeComputation(injector),
            References: (injector) => new DefaultReferences(injector),
            ReferenceFinder:  (injector) => new DefaultReferenceFinder(injector),
            GoToResolver: (injector) => new DefaultGoToResolverProvider(injector),
            DocumentHighlighter: (injector) => new DefaultDocumentHighlighter(injector)
        },
        completion: {
            CompletionProvider: (injector) => new DefaultCompletionProvider(injector),
            RuleInterpreter: () => new RuleInterpreter()
        },
        validation: {
            DocumentValidator: (injector) => new DefaultDocumentValidator(injector),
            ValidationRegistry: (injector) => new ValidationRegistry(injector)
        },
        serializer: {
            JsonSerializer: (injector) => new DefaultJsonSerializer(injector)
        },
        symbols: {
            DocumentSymbolProvider: (injector) => new DefaultDocumentSymbolProvider(injector)
        }
    };
}
