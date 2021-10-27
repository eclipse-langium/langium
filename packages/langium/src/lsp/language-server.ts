/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AbstractCancellationTokenSource, CancellationToken, Connection, FileChangeType, HandlerResult, InitializeResult,
    LSPErrorCodes, RequestHandler, ResponseError, TextDocumentIdentifier, TextDocuments, TextDocumentSyncKind
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';
import { OperationCancelled, startCancelableOperation } from '../utils/promise-util';

export function startLanguageServer(services: LangiumServices): void {
    const connection = services.lsp.Connection;
    if (!connection) {
        throw new Error('Starting a language server requires the languageServer.Connection service to be set.');
    }

    connection.onInitialize(async params => {
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
                foldingRangeProvider: {},
                hoverProvider: {},
                renameProvider: {
                    prepareProvider: true
                }
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
                if (params.workspaceFolders)
                    await services.index.IndexManager.initializeWorkspace(params.workspaceFolders);
            } catch (e) {
                console.error(e);
            }
        }
        return result;
    });

    const documents = services.documents.TextDocuments;

    addDocumentsHandler(connection, documents, services);
    addCompletionHandler(connection, services);
    addFindReferencesHandler(connection, services);
    addDocumentSymbolHandler(connection, services);
    addGotoDefinitionHandler(connection, services);
    addDocumentHighlightsHandler(connection, services);
    addFoldingRangeHandler(connection, services);
    addCodeActionHandler(connection, services);
    addRenameHandler(connection, services);
    addHoverHandler(connection, services);

    // Make the text document manager listen on the connection for open, change and close text document events.
    documents.listen(connection);

    // Start listening for incoming messages from the client.
    connection.listen();
}

export function addDocumentsHandler(connection: Connection, documents: TextDocuments<TextDocument>, services: LangiumServices): void {
    const documentBuilder = services.documents.DocumentBuilder;
    let changeTokenSource: AbstractCancellationTokenSource;
    let changePromise: Promise<void> | undefined;

    async function onDidChange(changed: URI[], deleted?: URI[]): Promise<void> {
        changeTokenSource?.cancel();
        if (changePromise) {
            await changePromise;
        }
        changeTokenSource = startCancelableOperation();
        changePromise = documentBuilder
            .update(changed, deleted ?? [], changeTokenSource.token)
            .catch(err => {
                if (err !== OperationCancelled) {
                    console.error('Error: ', err);
                }
            });
    }

    documents.onDidChangeContent(async change => {
        onDidChange([URI.parse(change.document.uri)]);
    });
    connection.onDidChangeWatchedFiles(async params => {
        const changedUris = params.changes.filter(e => e.type !== FileChangeType.Deleted).map(e => URI.parse(e.uri));
        const deletedUris = params.changes.filter(e => e.type === FileChangeType.Deleted).map(e => URI.parse(e.uri));
        onDidChange(changedUris, deletedUris);
    });
}

export function addCompletionHandler(connection: Connection, services: LangiumServices): void {
    const completionProvider = services.lsp.completion.CompletionProvider;
    connection.onCompletion(createHandler(
        (document, params, cancelToken) => {
            return completionProvider.getCompletion(document, params, cancelToken);
        },
        services
    ));
}

export function addFindReferencesHandler(connection: Connection, services: LangiumServices): void {
    const referenceFinder = services.lsp.ReferenceFinder;
    connection.onReferences(createHandler(
        (document, params, cancelToken) => referenceFinder.findReferences(document, params, cancelToken),
        services
    ));
}

export function addCodeActionHandler(connection: Connection, services: LangiumServices): void {
    const codeActionProvider = services.lsp.CodeActionProvider;
    if (!codeActionProvider) {
        return;
    }
    connection.onCodeAction(createHandler(
        (document, params, cancelToken) => codeActionProvider.getCodeActions(document, params, cancelToken),
        services
    ));
}

export function addDocumentSymbolHandler(connection: Connection, services: LangiumServices): void {
    const symbolProvider = services.lsp.DocumentSymbolProvider;
    connection.onDocumentSymbol(createHandler(
        (document, params, cancelToken) => symbolProvider.getSymbols(document, params, cancelToken),
        services
    ));
}

export function addGotoDefinitionHandler(connection: Connection, services: LangiumServices): void {
    connection.onDefinition(createHandler(
        (document, params, cancelToken) => services.lsp.GoToResolver.goToDefinition(document, params, cancelToken),
        services
    ));
}

export function addDocumentHighlightsHandler(connection: Connection, services: LangiumServices): void {
    const documentHighlighter = services.lsp.DocumentHighlighter;
    connection.onDocumentHighlight(createHandler(
        (document, params, cancelToken) => documentHighlighter.findHighlights(document, params, cancelToken),
        services
    ));
}

export function addHoverHandler(connection: Connection, services: LangiumServices): void {
    const hoverProvider = services.lsp.HoverProvider;
    connection.onHover(createHandler(
        (document, params, cancelToken) => hoverProvider.getHoverContent(document, params, cancelToken),
        services
    ));
}

export function addFoldingRangeHandler(connection: Connection, services: LangiumServices): void {
    const foldingRangeProvider = services.lsp.FoldingRangeProvider;
    connection.onFoldingRanges(createHandler(
        (document, params, cancelToken) => foldingRangeProvider.getFoldingRanges(document, params, cancelToken),
        services
    ));
}

export function addRenameHandler(connection: Connection, services: LangiumServices): void {
    const renameHandler = services.lsp.RenameHandler;
    connection.onRenameRequest(createHandler(
        (document, params, cancelToken) => renameHandler.renameElement(document, params, cancelToken),
        services
    ));
    connection.onPrepareRename(createHandler(
        (document, params, cancelToken) => renameHandler.prepareRename(document, params, cancelToken),
        services
    ));
}

export function createHandler<P extends { textDocument: TextDocumentIdentifier }, R, E = void>(
    serviceCall: (document: LangiumDocument, params: P, cancelToken: CancellationToken) => HandlerResult<R, E>,
    services: LangiumServices
): RequestHandler<P, R | null, E> {
    return async (params: P, cancelToken: CancellationToken) => {
        const document = paramsDocument(params, services);
        if (!document) {
            return null;
        }
        try {
            return await serviceCall(document, params, cancelToken);
        } catch (err) {
            return responseError<E>(err);
        }
    };
}

function paramsDocument(params: { textDocument: TextDocumentIdentifier }, services: LangiumServices): LangiumDocument | undefined {
    const uri = URI.parse(params.textDocument.uri);
    return services.documents.LangiumDocuments.getOrCreateDocument(uri);
}

function responseError<E = void>(err: unknown): ResponseError<E> {
    if (err === OperationCancelled) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'The request has been cancelled.');
    }
    if (err instanceof ResponseError) {
        return err;
    }
    throw err;
}
