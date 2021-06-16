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
import { ValidationRegistry } from './service/validation/validation-registry';
import { DocumentValidator } from './service/validation/document-validator';
import { JsonSerializer } from './serializer/json-serializer';
import { LangiumDocument } from './documents/document';
import { DocumentSymbolProvider } from './service/symbols/document-symbol-provider';
import { CompletionProvider } from './service/completion/completion-provider';
import { RuleInterpreter } from './service/completion/rule-interpreter';
import { ReferenceFinder } from './references/reference-finder';

export type LangiumGeneratedServices = {
    Parser: LangiumParser,
    GrammarAccess: GrammarAccess,
    AstReflection: AstReflection
}

export type LangiumServices = LangiumGeneratedServices & {
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
        ReferenceFinder: ReferenceFinder
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
