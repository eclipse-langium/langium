/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumParser } from './parser/langium-parser';
import { GrammarAccess } from './grammar/grammar-access';
import { AstReflection } from './syntax-tree';
import { DocumentBuilder } from './documents/document-builder';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { Linker } from './references/linker';
import { NameProvider } from './references/naming';
import { ScopeProvider, ScopeComputation } from './references/scope';
import { ValidationRegistry } from './lsp/validation/validation-registry';
import { DocumentValidator } from './lsp/validation/document-validator';
import { JsonSerializer } from './serializer/json-serializer';
import { LangiumDocument } from './documents/document';
import { DocumentSymbolProvider } from './lsp/document-symbol-provider';
import { CompletionProvider } from './lsp/completion/completion-provider';
import { RuleInterpreter } from './lsp/completion/rule-interpreter';
import { ValueConverter } from './parser/value-converter';
import { ReferenceFinder } from './lsp/reference-finder';
import { GoToResolver } from './lsp/goto';
import { DocumentHighlighter } from './lsp/document-highlighter';
import { References } from './references/references';

export type LangiumGeneratedServices = {
    Parser: LangiumParser,
    GrammarAccess: GrammarAccess,
    AstReflection: AstReflection
}

export type LangiumServices = LangiumGeneratedServices & {
    parser: {
        ValueConverter: ValueConverter
    }
    documents: {
        DocumentBuilder: DocumentBuilder,
        TextDocuments: TextDocuments<LangiumDocument>
    },
    languageServer: {
        Connection?: Connection
    },
    references: {
        Linker: Linker,
        NameProvider: NameProvider,
        ScopeProvider: ScopeProvider,
        ScopeComputation: ScopeComputation,
        References: References,
        ReferenceFinder: ReferenceFinder,
        GoToResolver: GoToResolver,
        DocumentHighlighter: DocumentHighlighter
    },
    completion: {
        CompletionProvider: CompletionProvider,
        RuleInterpreter: RuleInterpreter
    }
    validation: {
        DocumentValidator: DocumentValidator,
        ValidationRegistry: ValidationRegistry
    },
    serializer: {
        JsonSerializer: JsonSerializer
    },
    symbols: {
        DocumentSymbolProvider: DocumentSymbolProvider
    }
}

type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
}

export type PartialLangiumServices = DeepPartial<LangiumServices>
