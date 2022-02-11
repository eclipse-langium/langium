/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, TextDocuments } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { ParseResult } from '../parser/langium-parser';
import { ServiceRegistry } from '../service-registry';
import type { LangiumSharedServices } from '../services';
import type { AstNode, AstNodeDescription, Reference } from '../syntax-tree';
import type { Mutable } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { stream, Stream } from '../utils/stream';
import { FileSystemProvider } from './file-system-provider';

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
    /** Result of the validation phase */
    diagnostics?: Diagnostic[]
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
    /** The `IndexManager` service has processed AST nodes of this document. */
    IndexedContent = 2,
    /** Pre-processing steps such as scope precomputation have been executed. */
    Processed = 3,
    /** The `Linker` service has processed this document. */
    Linked = 4,
    /** The `IndexManager` service has processed AST node references of this document. */
    IndexedReferences = 5,
    /** The `DocumentValidator` service has processed this document. */
    Validated = 6
}

/**
 * Result of the scope precomputation phase (`ScopeComputation` service).
 * It maps every AST node to the set of symbols that are visible in the subtree of that node.
 */
export type PrecomputedScopes = MultiMap<AstNode, AstNodeDescription>

export interface DocumentSegment {
    readonly range: Range
    readonly offset: number
    readonly length: number
    readonly end: number
}

export function equalURI(uri1: URI, uri2: URI): boolean {
    return uri1.toString() === uri2.toString();
}

/**
 * Shared service for creating `TextDocument` instances.
 */
export interface TextDocumentFactory {
    fromUri(uri: URI): TextDocument;
}

export class DefaultTextDocumentFactory implements TextDocumentFactory {

    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly fileSystemProvider: FileSystemProvider;

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.fileSystemProvider = services.workspace.FileSystemProvider;
    }

    fromUri(uri: URI): TextDocument {
        const content = this.getContent(uri);
        const services = this.serviceRegistry.getServices(uri);
        return TextDocument.create(uri.toString(), services.LanguageMetaData.languageId, 0, content);
    }

    protected getContent(uri: URI): string {
        return this.fileSystemProvider.readFileSync(uri);
    }

}

/**
 * Shared service for creating `LangiumDocument` instances.
 */
export interface LangiumDocumentFactory {
    /**
     * Create a Langium document from a `TextDocument` (usually associated with a file).
     */
    fromTextDocument<T extends AstNode = AstNode>(textDocument: TextDocument, uri?: URI): LangiumDocument<T>;

    /**
     * Create an Langium document from an in-memory string.
     */
    fromString<T extends AstNode = AstNode>(text: string, uri: URI): LangiumDocument<T>;

    /**
     * Create an Langium document from a model that has been constructed in memory.
     */
    fromModel<T extends AstNode = AstNode>(model: T, uri: URI): LangiumDocument<T>;
}

export class DefaultLangiumDocumentFactory implements LangiumDocumentFactory {

    protected readonly serviceRegistry: ServiceRegistry;

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
    }

    fromTextDocument<T extends AstNode = AstNode>(textDocument: TextDocument, uri?: URI): LangiumDocument<T> {
        return this.create<T>(textDocument, undefined, undefined, uri);
    }

    fromString<T extends AstNode = AstNode>(text: string, uri: URI): LangiumDocument<T> {
        return this.create<T>(undefined, text, undefined, uri);
    }

    fromModel<T extends AstNode = AstNode>(model: T, uri: URI): LangiumDocument<T> {
        return this.create<T>(undefined, undefined, model, uri);
    }

    protected create<T extends AstNode>(textDocument: TextDocument | undefined, text: string | undefined, model: T | undefined, uri: URI | undefined): LangiumDocument<T> {
        if (uri === undefined) {
            uri = URI.parse(textDocument!.uri);
        }
        const services = this.serviceRegistry.getServices(uri);
        if (textDocument === undefined) {
            textDocument = TextDocument.create(uri.toString(), services.LanguageMetaData.languageId, 0, text ?? '');
        }
        let parseResult: ParseResult<T>;
        if (model === undefined) {
            parseResult = services.parser.LangiumParser.parse<T>(textDocument.getText());
        } else {
            parseResult = { value: model, parserErrors: [], lexerErrors: [] };
        }
        return documentFromText<T>(textDocument, parseResult, uri);
    }
}

/**
 * Convert a TextDocument and a ParseResult into a LangiumDocument.
 */
export function documentFromText<T extends AstNode = AstNode>(textDocument: TextDocument, parseResult: ParseResult<T>, uri?: URI): LangiumDocument<T> {
    const doc: LangiumDocument<T> = {
        parseResult,
        textDocument,
        uri: uri ?? URI.parse(textDocument.uri),
        state: DocumentState.Parsed,
        references: []
    };
    (parseResult.value as Mutable<AstNode>).$document = doc;
    return doc;
}

/**
 * Shared service that manages Langium documents.
 */
export interface LangiumDocuments {

    /**
     * A stream of all documents managed under this service.
     */
    readonly all: Stream<LangiumDocument>

    /**
     * Manage a new document under this service.
     * @throws an error if a document with the same URI is already present.
     */
    addDocument(document: LangiumDocument): void;

    /**
     * Retrieve the document with the given URI, if present. Otherwise create a new document
     * and add it to the managed documents.
     */
    getOrCreateDocument(uri: URI): LangiumDocument;

    /**
     * Returns `true` if a document with the given URI is managed under this service.
     */
    hasDocument(uri: URI): boolean;

    /**
     * Remove the document with the given URI, if present, and mark it as `Changed`, meaning
     * that its content is no longer valid. The next call to `getOrCreateDocument` with the same
     * URI will create a new document instance.
     */
    invalidateDocument(uri: URI): void;

}

export class DefaultLangiumDocuments implements LangiumDocuments {

    protected readonly documentMap: Map<string, LangiumDocument> = new Map();
    protected readonly textDocuments: TextDocuments<TextDocument>;
    protected readonly textDocumentFactory: TextDocumentFactory;
    protected readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: LangiumSharedServices) {
        this.textDocuments = services.workspace.TextDocuments;
        this.textDocumentFactory = services.workspace.TextDocumentFactory;
        this.langiumDocumentFactory = services.workspace.LangiumDocumentFactory;
    }

    get all(): Stream<LangiumDocument> {
        return stream(this.documentMap.values());
    }

    addDocument(document: LangiumDocument): void {
        const uriString = document.uri.toString();
        if (this.documentMap.has(uriString)) {
            throw new Error(`A document with the URI '${uriString}' is already present.`);
        }
        this.documentMap.set(uriString, document);
    }

    getOrCreateDocument(uri: URI): LangiumDocument {
        const uriString = uri.toString();
        let langiumDoc = this.documentMap.get(uriString);
        if (langiumDoc) {
            return langiumDoc;
        }
        const textDoc = this.textDocuments.get(uriString) ?? this.textDocumentFactory.fromUri(uri);
        langiumDoc = this.langiumDocumentFactory.fromTextDocument(textDoc, uri);
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
