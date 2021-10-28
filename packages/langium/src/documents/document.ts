/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { AstNode, AstNodeDescription, Reference } from '../syntax-tree';
import { LangiumParser, ParseResult } from '../parser/langium-parser';
import { URI } from 'vscode-uri';
import { Mutable } from '../utils/ast-util';
import { LanguageMetaData } from '../grammar/language-meta-data';
import { LangiumServices } from '../services';
import { stream, Stream } from '../utils/stream';

/**
 * A Langium document holds the parse result (AST and CST) and any additional state that is derived
 * from the AST, e.g. the result of scope precomputation.
 */
export interface LangiumDocument<T extends AstNode = AstNode> {
    /** The Uniform Resource Identifier (URI) of the document */
    uri: URI;
    /** The text document used to convert between offsets and positions */
    textDocument: TextDocument;
    /** The current state of the document */
    state: DocumentState;
    /** The parse result holds the Abstract Syntax Tree (AST) and potentially also parser / lexer errors */
    parseResult: ParseResult<T>;
    /** Result of the scope precomputation phase */
    precomputedScopes?: PrecomputedScopes;
    /** An array of all cross-references found in the AST while linking */
    references: Reference[];
}

/**
 * A document is subject to several phases that are run in predefined order. Any state value implies that
 * smaller state values are finished as well.
 */
export enum DocumentState {
    /** The text content has changed and needs to be parsed again. */
    Changed = 0,
    /** An AST has been created from the text content. */
    Parsed = 1,
    /** The `IndexManager` service has processed this document. */
    Indexed = 2,
    /** Pre-processing steps such as scope precomputation have been executed. */
    Processed = 3,
    /** The `Linker` service has processed this document. */
    Linked = 4,
    /** The `DocumentValidator` service has processed this document. */
    Validated = 5
}

/**
 * Result of the scope precomputation phase (`ScopeComputation` service).
 */
export type PrecomputedScopes = Map<AstNode, AstNodeDescription[]>

export interface DocumentSegment {
    readonly range: Range
    readonly offset: number
    readonly length: number
    readonly end: number
}

export function toDocumentSegment(document: TextDocument, start: number, end: number): DocumentSegment {
    const startPos = document.positionAt(start);
    const endPos = document.positionAt(end);
    return {
        range: {
            start: startPos,
            end: endPos
        },
        offset: start,
        end: end,
        get length() {
            return end - start;
        }
    };
}

export function documentFromText<T extends AstNode = AstNode>(textDocument: TextDocument, parseResult: ParseResult<T>): LangiumDocument<T> {
    const doc = {
        parseResult,
        textDocument,
        uri: URI.parse(textDocument.uri),
        state: DocumentState.Parsed,
        references: []
    };
    (parseResult.value as Mutable<AstNode>).$document = doc;
    return doc;
}

export interface TextDocumentFactory {
    fromUri(uri: URI): TextDocument;
}

export class DefaultTextDocumentFactory implements TextDocumentFactory {

    protected readonly languageMetaData: LanguageMetaData;

    constructor(services: LangiumServices) {
        this.languageMetaData = services.LanguageMetaData;
    }

    fromUri(uri: URI): TextDocument {
        const content = fs.readFileSync(uri.fsPath, 'utf-8');
        return TextDocument.create(uri.toString(), this.languageMetaData.languageId, 0, content);
    }

}

export interface LangiumDocumentFactory {
    fromTextDocument<T extends AstNode = AstNode>(textDocument: TextDocument): LangiumDocument<T>;
}

export class DefaultLangiumDocumentFactory implements LangiumDocumentFactory {

    protected readonly parser: LangiumParser;

    constructor(services: LangiumServices) {
        this.parser = services.parser.LangiumParser;
    }

    fromTextDocument<T extends AstNode = AstNode>(textDocument: TextDocument): LangiumDocument<T> {
        return documentFromText<T>(textDocument, this.parser.parse(textDocument.getText()));
    }
}

export interface LangiumDocuments {
    readonly all: Stream<LangiumDocument>
    getOrCreateDocument(uri: URI): LangiumDocument;
    hasDocument(uri: URI): boolean;
    invalidateDocument(uri: URI): void;
}

export class DefaultLangiumDocuments implements LangiumDocuments {

    protected readonly documentMap: Map<string, LangiumDocument> = new Map();
    protected readonly textDocuments: TextDocuments<TextDocument>;
    protected readonly textDocumentFactory: TextDocumentFactory;
    protected readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: LangiumServices) {
        this.textDocuments = services.documents.TextDocuments;
        this.textDocumentFactory = services.documents.TextDocumentFactory;
        this.langiumDocumentFactory = services.documents.LangiumDocumentFactory;
    }

    get all(): Stream<LangiumDocument> {
        return stream(this.documentMap.values());
    }

    getOrCreateDocument(uri: URI): LangiumDocument {
        const uriString = uri.toString();
        let langiumDoc = this.documentMap.get(uriString);
        if (langiumDoc) {
            return langiumDoc;
        }
        let textDoc = this.textDocuments.get(uriString);
        if (!textDoc) {
            textDoc = this.textDocumentFactory.fromUri(uri);
        }
        langiumDoc = this.langiumDocumentFactory.fromTextDocument(textDoc);
        this.documentMap.set(uriString, langiumDoc);
        return langiumDoc;
    }

    hasDocument(uri: URI): boolean {
        return this.documentMap.has(uri.toString());
    }

    invalidateDocument(uri: URI): void {
        const uriString = uri.toString();
        const langiumDoc = this.documentMap.get(uriString);
        if (langiumDoc) {
            langiumDoc.state = DocumentState.Changed;
            this.documentMap.delete(uriString);
        }
    }
}
