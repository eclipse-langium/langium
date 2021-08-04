/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstReflection } from './syntax-tree';
import { DocumentBuilder } from './documents/document-builder';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { LangiumDocument } from './documents/document';
import { DocumentBuilder } from './documents/document-builder';
import { GrammarAccess } from './grammar/grammar-access';
import { LanguageMetaData } from './grammar/language-meta-data';
import { AstNodePathComputer } from './index/ast-node-locator';
import { IndexManager } from './index/workspace-index-manager';
import { CompletionProvider } from './lsp/completion/completion-provider';
import { RuleInterpreter } from './lsp/completion/rule-interpreter';
import { DocumentHighlighter } from './lsp/document-highlighter';
import { DocumentSymbolProvider } from './lsp/document-symbol-provider';
import { GoToResolver } from './lsp/goto';
import { ReferenceFinder } from './lsp/reference-finder';
import { LangiumParser } from './parser/langium-parser';
import { ValueConverter } from './parser/value-converter';
import { Linker } from './references/linker';
import { NameProvider } from './references/naming';
import { References } from './references/references';
import { ScopeComputation, ScopeProvider } from './references/scope';
import { JsonSerializer } from './serializer/json-serializer';
import { AstReflection } from './syntax-tree';
import { DocumentValidator } from './validation/document-validator';
import { ValidationRegistry } from './validation/validation-registry';
import { Grammar } from './grammar/generated/ast';
import { LangiumParser } from './parser/langium-parser';
import { TokenBuilder } from './parser/token-builder';
import { LanguageMetaData } from './grammar/language-meta-data';
import { CodeActionProvider} from './lsp/code-action';
import { MonikerProvider } from './references/moniker';
import { IndexManager } from './index/workspace-index-manager';
import { AstNodePathComputer } from './index/ast-node-locator';

export type LangiumGeneratedServices = {
    Grammar: Grammar
    AstReflection: AstReflection
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
        LangiumParser: LangiumParser
        TokenBuilder: TokenBuilder
    }
    documents: {
        DocumentBuilder: DocumentBuilder
        TextDocuments: TextDocuments<LangiumDocument>
    }
    lsp: LangiumLspServices
    index: {
        IndexManager: IndexManager
        AstNodePathComputer: AstNodePathComputer
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
