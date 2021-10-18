/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Connection, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AstReflection, CompletionProvider, DocumentBuilder, LangiumDocumentFactory, LangiumDocuments, DocumentValidator, Grammar, JsonSerializer, LangiumParser, LanguageMetaData, Linker, NameProvider, RuleInterpreter, ScopeComputation, ScopeProvider, TextDocumentFactory, ValidationRegistry, IParserConfig } from '.';
import { AstNodeDescriptionProvider, ReferenceDescriptionProvider } from './index/ast-descriptions';
import { AstNodeLocator } from './index/ast-node-locator';
import { IndexManager } from './index/index-manager';
import { CodeActionProvider } from './lsp/code-action';
import { DocumentHighlighter } from './lsp/document-highlighter';
import { DocumentSymbolProvider } from './lsp/document-symbol-provider';
import { GoToResolver } from './lsp/goto';
import { ReferenceFinder } from './lsp/reference-finder';
import { RenameHandler } from './lsp/rename-refactoring';
import { TokenBuilder } from './parser/token-builder';
import { HoverProvider } from './lsp/hover-provider';
import { FoldingRangeProvider } from './lsp/folding-range-provider';
import { GrammarConfig } from './grammar/grammar-config';
import { References } from './references/references';
import { ValueConverter } from './parser/value-converter';

export type LangiumGeneratedServices = {
    Grammar: Grammar
    AstReflection: AstReflection
    LanguageMetaData: LanguageMetaData
    parser: {
        ParserConfig?: IParserConfig
    }
}

export type LangiumLspServices = {
    completion: {
        CompletionProvider: CompletionProvider
        RuleInterpreter: RuleInterpreter
    }
    Connection?: Connection
    DocumentHighlighter: DocumentHighlighter
    DocumentSymbolProvider: DocumentSymbolProvider
    HoverProvider: HoverProvider
    FoldingRangeProvider: FoldingRangeProvider
    GoToResolver: GoToResolver
    ReferenceFinder: ReferenceFinder
    CodeActionProvider?: CodeActionProvider
    RenameHandler: RenameHandler
}

export type LangiumDefaultServices = {
    parser: {
        GrammarConfig: GrammarConfig
        ValueConverter: ValueConverter
        LangiumParser: LangiumParser
        TokenBuilder: TokenBuilder
    }
    documents: {
        DocumentBuilder: DocumentBuilder
        LangiumDocuments: LangiumDocuments
        LangiumDocumentFactory: LangiumDocumentFactory
        TextDocuments: TextDocuments<TextDocument>
        TextDocumentFactory: TextDocumentFactory
    }
    lsp: LangiumLspServices
    index: {
        IndexManager: IndexManager
        AstNodeLocator: AstNodeLocator
        AstNodeDescriptionProvider: AstNodeDescriptionProvider
        ReferenceDescriptionProvider: ReferenceDescriptionProvider
    }
    references: {
        Linker: Linker
        NameProvider: NameProvider
        References: References
        ScopeProvider: ScopeProvider
        ScopeComputation: ScopeComputation
    }
    serializer: {
        JsonSerializer: JsonSerializer
    }
    validation: {
        DocumentValidator: DocumentValidator
        ValidationRegistry: ValidationRegistry
    }
}

export type LangiumServices = LangiumGeneratedServices & LangiumDefaultServices

// We basically look into T to see whether its type definition contains any methods. (with T[keyof T])
// If it does, it's one of our services and therefore should not be partialized.
// eslint-disable-next-line @typescript-eslint/ban-types
type DeepPartial<T> = T[keyof T] extends Function ? T : {
    [P in keyof T]?: DeepPartial<T[P]>;
}

export type PartialLangiumServices = DeepPartial<LangiumServices>
