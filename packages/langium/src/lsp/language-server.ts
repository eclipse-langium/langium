/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AbstractCancellationTokenSource, CancellationToken, Connection, FileChangeType, HandlerResult, InitializeResult,
    LSPErrorCodes, RequestHandler, ResponseError, ServerRequestHandler, TextDocumentIdentifier, TextDocumentSyncKind
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { LangiumServices, LangiumSharedServices } from '../services';
import { OperationCancelled, startCancelableOperation } from '../utils/promise-util';
import { DocumentState, LangiumDocument } from '../workspace/documents';
import { DefaultSemanticTokenOptions } from './semantic-token-provider';

export function startLanguageServer(services: LangiumSharedServices): void {
    const languages: readonly LangiumServices[] = services.ServiceRegistry.all;
    const connection = services.lsp.Connection;
    if (!connection) {
        throw new Error('Starting a language server requires the languageServer.Connection service to be set.');
    }

    connection.onInitialize(async params => {
        const result: InitializeResult = {
            capabilities: {
                workspace: {
                    workspaceFolders: {
                        supported: true
                    }
                },
                textDocumentSync: TextDocumentSyncKind.Incremental,
                completionProvider: {},
                referencesProvider: {}, // TODO enable workDoneProgress?
                documentSymbolProvider: {},
                definitionProvider: {},
                documentHighlightProvider: {},
                codeActionProvider: languages.some(e => e.lsp.CodeActionProvider !== undefined) ? {} : undefined,
                foldingRangeProvider: {},
                hoverProvider: {},
                renameProvider: {
                    prepareProvider: true
                },
                semanticTokensProvider: languages.some(e => e.lsp.SemanticTokenProvider !== undefined)
                    ? DefaultSemanticTokenOptions
                    : undefined
            }
        };

        try {
            if (params.workspaceFolders) {
                await services.workspace.WorkspaceManager.initializeWorkspace(params.workspaceFolders);
            }
        } catch (err) {
            console.error(err);
        }
        return result;
    });

    addDocumentsHandler(connection, services);
    addDiagnosticsHandler(connection, services);
    addCompletionHandler(connection, services);
    addFindReferencesHandler(connection, services);
    addDocumentSymbolHandler(connection, services);
    addGotoDefinitionHandler(connection, services);
    addDocumentHighlightsHandler(connection, services);
    addFoldingRangeHandler(connection, services);
    addCodeActionHandler(connection, services);
    addRenameHandler(connection, services);
    addHoverHandler(connection, services);
    addSemanticHighlighting(connection, services);

    // Make the text document manager listen on the connection for open, change and close text document events.
    const documents = services.workspace.TextDocuments;
    documents.listen(connection);

    // Start listening for incoming messages from the client.
    connection.listen();
}

export function addDocumentsHandler(connection: Connection, services: LangiumSharedServices): void {
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

    const documents = services.workspace.TextDocuments;
    documents.onDidChangeContent(async change => {
        onDidChange([URI.parse(change.document.uri)]);
    });
    connection.onDidChangeWatchedFiles(async params => {
        const changedUris = params.changes.filter(e => e.type !== FileChangeType.Deleted).map(e => URI.parse(e.uri));
        const deletedUris = params.changes.filter(e => e.type === FileChangeType.Deleted).map(e => URI.parse(e.uri));
        onDidChange(changedUris, deletedUris);
    });
}

export function addDiagnosticsHandler(connection: Connection, services: LangiumSharedServices): void {
    const documentBuilder = services.workspace.DocumentBuilder;
    documentBuilder.onBuildPhase(DocumentState.Validated, async (documents, cancelToken) => {
        for (const document of documents) {
            if (document.diagnostics) {
                connection.sendDiagnostics({
                    uri: document.uri.toString(),
                    diagnostics: document.diagnostics
                });
            }
            if (cancelToken.isCancellationRequested) {
                return;
            }
        }
    });
}

export function addCompletionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onCompletion(createRequestHandler(
        (services, document, params, cancelToken) => {
            return services.lsp.completion.CompletionProvider.getCompletion(document, params, cancelToken);
        },
        services
    ));
}

export function addFindReferencesHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onReferences(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.ReferenceFinder.findReferences(document, params, cancelToken),
        services
    ));
}

export function addCodeActionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onCodeAction(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.CodeActionProvider?.getCodeActions(document, params, cancelToken),
        services
    ));
}

export function addDocumentSymbolHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDocumentSymbol(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.DocumentSymbolProvider.getSymbols(document, params, cancelToken),
        services
    ));
}

export function addGotoDefinitionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDefinition(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.GoToResolver.goToDefinition(document, params, cancelToken),
        services
    ));
}

export function addDocumentHighlightsHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDocumentHighlight(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.DocumentHighlighter.findHighlights(document, params, cancelToken),
        services
    ));
}

export function addHoverHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onHover(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.HoverProvider.getHoverContent(document, params, cancelToken),
        services
    ));
}

export function addFoldingRangeHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onFoldingRanges(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.FoldingRangeProvider.getFoldingRanges(document, params, cancelToken),
        services
    ));
}

export function addRenameHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onRenameRequest(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.RenameHandler.renameElement(document, params, cancelToken),
        services
    ));
    connection.onPrepareRename(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.RenameHandler.prepareRename(document, params, cancelToken),
        services
    ));
}

export function addSemanticHighlighting(connection: Connection, services: LangiumSharedServices): void {
    connection.languages.semanticTokens.on(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.SemanticTokenProvider) {
                return services.lsp.SemanticTokenProvider.semanticHighlight(document, params, cancelToken);
            }
            return new ResponseError<void>(0, '');
        },
        services
    ));
    connection.languages.semanticTokens.onDelta(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.SemanticTokenProvider) {
                return services.lsp.SemanticTokenProvider.semanticHighlightDelta(document, params, cancelToken);
            }
            return new ResponseError<void>(0, '');
        },
        services
    ));
    connection.languages.semanticTokens.onRange(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.SemanticTokenProvider) {
                return services.lsp.SemanticTokenProvider.semanticHighlightRange(document, params, cancelToken);
            }
            return new ResponseError<void>(0, '');
        },
        services
    ));
}

export function createServerRequestHandler<P extends { textDocument: TextDocumentIdentifier }, R, PR, E = void>(
    serviceCall: (services: LangiumServices, document: LangiumDocument, params: P, cancelToken: CancellationToken) => HandlerResult<R, E>,
    sharedServices: LangiumSharedServices
): ServerRequestHandler<P, R, PR, E> {
    return async (params: P, cancelToken: CancellationToken) => {
        const uri = URI.parse(params.textDocument.uri);
        const language = sharedServices.ServiceRegistry.getServices(uri);
        if (!language) {
            console.error(`Could not find service instance for uri: '${uri.toString()}'`);
            throw new Error();
        }
        const document = sharedServices.workspace.LangiumDocuments.getOrCreateDocument(uri);
        if (!document) {
            throw new Error();
        }
        try {
            return await serviceCall(language, document, params, cancelToken);
        } catch (err) {
            return responseError<E>(err);
        }
    };
}

export function createRequestHandler<P extends { textDocument: TextDocumentIdentifier }, R, E = void>(
    serviceCall: (services: LangiumServices, document: LangiumDocument, params: P, cancelToken: CancellationToken) => HandlerResult<R, E>,
    sharedServices: LangiumSharedServices
): RequestHandler<P, R | null, E> {
    return async (params: P, cancelToken: CancellationToken) => {
        const uri = URI.parse(params.textDocument.uri);
        const language = sharedServices.ServiceRegistry.getServices(uri);
        if (!language) {
            console.error(`Could not find service instance for uri: '${uri.toString()}'`);
            return null;
        }
        const document = sharedServices.workspace.LangiumDocuments.getOrCreateDocument(uri);
        if (!document) {
            return null;
        }
        try {
            return await serviceCall(language, document, params, cancelToken);
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
