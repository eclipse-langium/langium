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
import { ValidationRegistry } from './validation/validation-registry';
import { DocumentValidator } from './validation/document-validator';
import { LanguageMetaData } from './grammar/language-meta-data';
import { CodeActionProvider} from './lsp/code-action';

export type LangiumGeneratedServices = {
    parser: {
        LangiumParser: LangiumParser
    }
    AstReflection: AstReflection
    GrammarAccess: GrammarAccess
    LanguageMetaData: LanguageMetaData
}

export type LangiumLspServices = {
    completion: {
        CompletionProvider: CompletionProvider
        RuleInterpreter: RuleInterpreter
    }
    Connection?: Connection
    DocumentHighlighter: DocumentHighlighter
    DocumentSymbolProvider: DocumentSymbolProvider
    GoToResolver: GoToResolver
    ReferenceFinder: ReferenceFinder
    CodeActionProvider?: CodeActionProvider
}

export type LangiumDefaultServices = {
    parser: {
        ValueConverter: ValueConverter
    }
    documents: {
        DocumentBuilder: DocumentBuilder
        TextDocuments: TextDocuments<LangiumDocument>
    }
    lsp: LangiumLspServices
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
