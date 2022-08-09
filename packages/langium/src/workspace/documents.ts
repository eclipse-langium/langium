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
    readonly uri: URI;
    /** The text document used to convert between offsets and positions */
    readonly textDocument: TextDocument;
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
    /**
     * The text content has changed and needs to be parsed again. The AST held by this outdated
     * document instance is no longer valid.
     */
    Changed = 0,
    /**
     * An AST has been created from the text content. The document structure can be traversed,
     * but cross-references cannot be resolved yet. If necessary, the structure can be manipulated
     * at this stage as a preprocessing step.
     */
    Parsed = 1,
    /**
     * The `IndexManager` service has processed AST nodes of this document. This means the
     * exported symbols are available in the global scope and can be resolved from other documents.
     */
    IndexedContent = 2,
    /**
     * The `ScopeComputation` service has processed this document. This means the local symbols
     * are stored in a MultiMap so they can be looked up by the `ScopeProvider` service.
     * Once a document has reached this state, you may follow every reference - it will lazily
     * resolve its `ref` property and yield either the target AST node or `undefined` in case
     * the target is not in scope.
     */
    ComputedScopes = 3,
    /**
     * The `Linker` service has processed this document. All outgoing references have been
     * resolved or marked as erroneous.
     */
    Linked = 4,
    /**
     * The `IndexManager` service has processed AST node references of this document. This is
     * necessary to determine which documents are affected by a change in one of the workspace
     * documents.
     */
    IndexedReferences = 5,
    /**
     * The `DocumentValidator` service has processed this document. The language server listens
     * to the results of this phase and sends diagnostics to the client.
     */
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

/**
 * Shared service for creating `TextDocument` instances.
 * @deprecated This service is no longer necessary and will be removed.
 */
export interface TextDocumentFactory {
    /**
     * Creates a `TextDocument` from a given `URI`.
     */
    fromUri(uri: URI): TextDocument;
}

/**
 * @deprecated This service implementation is no longer necessary and will be removed.
 */
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
        let parseResult: ParseResult<T>;
        if (model === undefined) {
            parseResult = services.parser.LangiumParser.parse<T>(text ?? textDocument!.getText());
        } else {
            parseResult = { value: model, parserErrors: [], lexerErrors: [] };
        }
        return this.createLangiumDocument<T>(parseResult, uri, textDocument ?? {
            $template: true,
            languageId: services.LanguageMetaData.languageId,
            uri,
            text
        });
    }

    /**
     * Create a LangiumDocument from a given parse result.
     *
     * A TextDocument is created on demand if it is not provided as argument here. Usually this
     * should not be necessary because the main purpose of the TextDocument is to convert between
     * text ranges and offsets, which is done solely in LSP request handling.
     */
    protected createLangiumDocument<T extends AstNode = AstNode>(parseResult: ParseResult<T>, uri: URI, textDocument: TextDocument | TextDocumentTemplate): LangiumDocument<T> {
        let textDoc: TextDocument | undefined = undefined;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const factory = this;
        const doc: LangiumDocument<T> = {
            parseResult,
            uri: uri,
            state: DocumentState.Parsed,
            references: [],
            get textDocument() {
                if (!textDoc) {
                    textDoc = (textDocument as TextDocumentTemplate).$template
                        ? factory.createTextDocument(textDocument as TextDocumentTemplate)
                        : textDocument as TextDocument;
                }
                return textDoc;
            }
        };
        (parseResult.value as Mutable<AstNode>).$document = doc;
        return doc;
    }

    protected createTextDocument(template: TextDocumentTemplate): TextDocument {
        return TextDocument.create(template.uri.toString(), template.languageId, 0, template.text ?? '');
    }

}

/**
 * Necessary information to create a TextDocument.
 */
export interface TextDocumentTemplate {
    $template: true
    languageId: string
    uri: URI
    text?: string
}

/**
 * Shared service for managing Langium documents.
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
    protected readonly fileSystemProvider: FileSystemProvider;
    protected readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: LangiumSharedServices) {
        this.textDocuments = services.workspace.TextDocuments;
        this.fileSystemProvider = services.workspace.FileSystemProvider;
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
            // The document is already present in our map
            return langiumDoc;
        }
        const textDoc = this.textDocuments.get(uriString);
        if (textDoc) {
            // The document is managed by the TextDocuments service, which means it is opened in the editor
            langiumDoc = this.langiumDocumentFactory.fromTextDocument(textDoc, uri);
        } else {
            // Load the document from file
            langiumDoc = this.langiumDocumentFactory.fromString(this.getContent(uri), uri);
        }
        this.documentMap.set(uriString, langiumDoc);
        return langiumDoc;
    }

    protected getContent(uri: URI): string {
        return this.fileSystemProvider.readFileSync(uri);
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
