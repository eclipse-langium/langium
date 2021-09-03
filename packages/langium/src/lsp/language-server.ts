/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    CodeAction,
    CodeActionParams,
    Command,
    CompletionList, Connection,
    DocumentHighlightParams, DocumentSymbol, DocumentSymbolParams, InitializeParams, InitializeResult,
    Location, LocationLink, ReferenceParams, TextDocumentPositionParams, TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';

export function startLanguageServer(services: LangiumServices): void {
    const connection = services.lsp.Connection;
    if (!connection) {
        throw new Error('Starting a language server requires the languageServer.Connection service to be set.');
    }

    connection.onInitialize((params: InitializeParams) => {
        const capabilities = params.capabilities;
        const hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;

        const result: InitializeResult = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                // Tell the client that this server supports code completion.
                completionProvider: {},
                referencesProvider: {}, // TODO enable workDoneProgress?
                documentSymbolProvider: {},
                definitionProvider: {},
                documentHighlightProvider: {},
                codeActionProvider: services.lsp.CodeActionProvider ? {} : undefined,
                // hoverProvider needs to be created for mouse-over events, etc.
                hoverProvider: false,
                monikerProvider: {}
            }
        };

        if (hasWorkspaceFolderCapability) {
            result.capabilities.workspace = {
                workspaceFolders: {
                    supported: true
                }
            };
        }

        if (params.capabilities.workspace?.configuration) {
            try {
                // experimental
                if (params.workspaceFolders)
                    services.index.IndexManager.initializeWorkspace(params.workspaceFolders);
            } catch (e) {
                console.error(e);
            }
        }
        return result;
    });

    const langiumDocs = services.documents.Documents;
    const documents = services.documents.TextDocuments;
    const documentBuilder = services.documents.DocumentBuilder;
    documents.onDidChangeContent(change => {
        console.debug('Documents in service:' + documents.keys().length);
        langiumDocs.invalidateDocument(change.document.uri);
        const newDocument = langiumDocs.createOrGetDocument(change.document.uri);
        if (newDocument.parseResult?.value) {
            services.index.IndexManager.update(newDocument);
        }
        langiumDocs.all.filter(doc => isAffected(doc, change.document.uri)).forEach(
            doc => {
                documentBuilder.build(doc);
                services.index.IndexManager.update(doc);
            }
        );
        documentBuilder.build(newDocument);
    });
    documents.onDidClose(() => {
        if (documents.keys().length === 0)
            langiumDocs.invalidateAllDocuments(); // clean up all cached document
    });
    addCompletionHandler(connection, services);
    addFindReferencesHandler(connection, services);
    addDocumentSymbolHandler(connection, services);
    addGotoDefinition(connection, services);
    addDocumentHighlightsHandler(connection, services);
    addCodeActionHandler(connection, services);

    // Make the text document manager listen on the connection for open, change and close text document events.
    documents.listen(connection);

    // Listen on the connection.
    connection.listen();
}

function isAffected(document: LangiumDocument, changedUri: string): boolean {
    return changedUri !== document.textDocument.uri;
}

export function addCompletionHandler(connection: Connection, services: LangiumServices): void {
    // TODO create an extensible service API for completion
    connection.onCompletion(
        (_textDocumentPosition: TextDocumentPositionParams): CompletionList => {
            const document = paramsDocument(_textDocumentPosition, services);
            if (document && document.parseResult) {
                const offset = document.textDocument.offsetAt(_textDocumentPosition.position);
                const completionProvider = services.lsp.completion.CompletionProvider;
                const assist = completionProvider.getCompletion(document.parseResult?.value, offset);
                return assist;
            } else {
                return CompletionList.create();
            }
        }
    );
}

export function addFindReferencesHandler(connection: Connection, services: LangiumServices): void {
    const referenceFinder = services.lsp.ReferenceFinder;
    connection.onReferences((params: ReferenceParams): Location[] => {
        const document = paramsDocument(params, services);
        if (document) {
            return referenceFinder.findReferences(document, params, params.context.includeDeclaration);
        } else {
            return [];
        }
    });
}

export function addCodeActionHandler(connection: Connection, services: LangiumServices): void {
    const codeActionProvider = services.lsp.CodeActionProvider;
    if (!codeActionProvider) {
        return;
    }
    connection.onCodeAction((params: CodeActionParams): Array< Command | CodeAction > | null => {
        const document = paramsDocument(params, services);
        if (document) {
            return codeActionProvider.getCodeActions(document, params);
        } else {
            return [];
        }
    });
}

export function addDocumentSymbolHandler(connection: Connection, services: LangiumServices): void {
    const symbolProvider = services.lsp.DocumentSymbolProvider;
    connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
        const document = paramsDocument(params, services);
        if (document) {
            return symbolProvider.getSymbols(document);
        } else {
            return [];
        }
    });
}

export function addGotoDefinition(connection: Connection, services: LangiumServices): void {
    connection.onDefinition(
        (_textDocumentPosition: TextDocumentPositionParams): LocationLink[] => {
            const document = paramsDocument(_textDocumentPosition, services);
            if (document) {
                return services.lsp.GoToResolver.goToDefinition(document, _textDocumentPosition);
            }
            else {
                return [];
            }
        }
    );
}

export function addDocumentHighlightsHandler(connection: Connection, services: LangiumServices): void {
    const documentHighlighter = services.lsp.DocumentHighlighter;
    connection.onDocumentHighlight((params: DocumentHighlightParams): Location[] => {
        const document = paramsDocument(params, services);
        if (document) {
            return documentHighlighter.findHighlights(document, params);
        } else {
            return [];
        }
    });
}

function paramsDocument(params: TextDocumentPositionParams | DocumentSymbolParams, services: LangiumServices): LangiumDocument | undefined {
    const uri = params.textDocument.uri;
    return services.documents.Documents.createOrGetDocument(uri);
}
