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
import { LangiumServices, LangiumSharedServices } from '../services';
import { OperationCancelled, startCancelableOperation } from '../utils/promise-util';

export function startLanguageServer(services: LangiumSharedServices): void {
    const all: LangiumServices[] = services.ServiceRegistry.all;
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
                codeActionProvider: all.some(e => e.lsp.CodeActionProvider !== undefined) ? {} : undefined,
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
                    await services.workspace.IndexManager.initializeWorkspace(params.workspaceFolders);
            } catch (e) {
                console.error(e);
            }
        }
        return result;
    });

    const documents = services.workspace.TextDocuments;

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

export function addDocumentsHandler(connection: Connection, documents: TextDocuments<TextDocument>, services: LangiumSharedServices): void {
    const documentBuilder = services.workspace.DocumentBuilder;
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

export function addCompletionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onCompletion(createHandler(
        (services, document, params, cancelToken) => {
            return services.lsp.completion.CompletionProvider.getCompletion(document, params, cancelToken);
        },
        services
    ));
}

export function addFindReferencesHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onReferences(createHandler(
        (services, document, params, cancelToken) => services.lsp.ReferenceFinder.findReferences(document, params, cancelToken),
        services
    ));
}

export function addCodeActionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onCodeAction(createHandler(
        (services, document, params, cancelToken) => services.lsp.CodeActionProvider?.getCodeActions(document, params, cancelToken),
        services
    ));
}

export function addDocumentSymbolHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDocumentSymbol(createHandler(
        (services, document, params, cancelToken) => services.lsp.DocumentSymbolProvider.getSymbols(document, params, cancelToken),
        services
    ));
}

export function addGotoDefinitionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDefinition(createHandler(
        (services, document, params, cancelToken) => services.lsp.GoToResolver.goToDefinition(document, params, cancelToken),
        services
    ));
}

export function addDocumentHighlightsHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDocumentHighlight(createHandler(
        (services, document, params, cancelToken) => services.lsp.DocumentHighlighter.findHighlights(document, params, cancelToken),
        services
    ));
}

export function addHoverHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onHover(createHandler(
        (services, document, params, cancelToken) => services.lsp.HoverProvider.getHoverContent(document, params, cancelToken),
        services
    ));
}

export function addFoldingRangeHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onFoldingRanges(createHandler(
        (services, document, params, cancelToken) => services.lsp.FoldingRangeProvider.getFoldingRanges(document, params, cancelToken),
        services
    ));
}

export function addRenameHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onRenameRequest(createHandler(
        (services, document, params, cancelToken) => services.lsp.RenameHandler.renameElement(document, params, cancelToken),
        services
    ));
    connection.onPrepareRename(createHandler(
        (services, document, params, cancelToken) => services.lsp.RenameHandler.prepareRename(document, params, cancelToken),
        services
    ));
}

export function createHandler<P extends { textDocument: TextDocumentIdentifier }, R, E = void>(
    serviceCall: (services: LangiumServices, document: LangiumDocument, params: P, cancelToken: CancellationToken) => HandlerResult<R, E>,
    services: LangiumSharedServices
): RequestHandler<P, R | null, E> {
    return async (params: P, cancelToken: CancellationToken) => {
        const uri = URI.parse(params.textDocument.uri);
        const concreteServices = services.ServiceRegistry.getService(uri);
        if (!concreteServices) {
            console.error(`Could not find service instance for uri: '${uri.toString()}'`);
            return null;
        }
        const document = services.workspace.LangiumDocuments.getOrCreateDocument(uri);
        if (!document) {
            return null;
        }
        try {
            return await serviceCall(concreteServices, document, params, cancelToken);
        } catch (err) {
            return responseError<E>(err);
        }
    };
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
