/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AbstractCancellationTokenSource,
    CodeAction,
    CodeActionParams,
    Command,
    CompletionList, Connection,
    DocumentHighlightParams, DocumentSymbol, DocumentSymbolParams, FoldingRange, FoldingRangeParams, InitializeResult,
    Location, LocationLink, ReferenceParams, TextDocumentPositionParams, TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';
import { OperationCanceled, startCancelableOperation } from '../utils/promise-util';

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
                // experimental
                if (params.workspaceFolders)
                    await services.index.IndexManager.initializeWorkspace(params.workspaceFolders);
            } catch (e) {
                console.error(e);
            }
        }
        return result;
    });

    const documents = services.documents.TextDocuments;
    const documentBuilder = services.documents.DocumentBuilder;
    let changeTokenSource: AbstractCancellationTokenSource;
    let changePromise: Promise<void> | undefined;
    documents.onDidChangeContent(async change => {
        changeTokenSource?.cancel();
        if (changePromise) {
            await changePromise;
        }
        changeTokenSource = startCancelableOperation();
        changePromise = documentBuilder.documentChanged(URI.parse(change.document.uri), changeTokenSource.token).catch(err => {
            if (err !== OperationCanceled) {
                throw err;
            }
        });
    });
    addCompletionHandler(connection, services);
    addFindReferencesHandler(connection, services);
    addDocumentSymbolHandler(connection, services);
    addGotoDefinition(connection, services);
    addDocumentHighlightsHandler(connection, services);
    addFoldingRangeHandler(connection, services);
    addCodeActionHandler(connection, services);
    addRenameHandler(connection, services);
    addHoverHandler(connection, services);

    // Make the text document manager listen on the connection for open, change and close text document events.
    documents.listen(connection);

    // Listen on the connection.
    connection.listen();
}

export function addCompletionHandler(connection: Connection, services: LangiumServices): void {
    // TODO create an extensible service API for completion
    connection.onCompletion(
        (_textDocumentPosition: TextDocumentPositionParams): CompletionList => {
            const document = paramsDocument(_textDocumentPosition, services);
            if (document) {
                const offset = document.textDocument.offsetAt(_textDocumentPosition.position);
                const completionProvider = services.lsp.completion.CompletionProvider;
                const assist = completionProvider.getCompletion(document.parseResult.value, offset);
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
    connection.onCodeAction((params: CodeActionParams): Array<Command | CodeAction> | null => {
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

export function addHoverHandler(connection: Connection, services: LangiumServices): void {
    const hoverProvider = services.lsp.HoverProvider;
    connection.onHover(params => {
        const document = paramsDocument(params, services);
        return document && hoverProvider.getHoverContent(document, params);
    });
}

export function addFoldingRangeHandler(connection: Connection, services: LangiumServices): void {
    const foldingRangeProvider = services.lsp.FoldingRangeProvider;
    connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
        const document = paramsDocument(params, services);
        if (document) {
            return foldingRangeProvider.getFoldingRanges(document);
        } else {
            return [];
        }
    });
}

export function addRenameHandler(connection: Connection, services: LangiumServices): void {
    const renameHandler = services.lsp.RenameHandler;
    connection.onRenameRequest(params => {
        const document = paramsDocument(params, services);
        return document ? renameHandler.renameElement(document, params) : undefined;
    });
    connection.onPrepareRename(params => {
        const document = paramsDocument(params, services);
        return document ? renameHandler.prepareRename(document, params) : undefined;
    });
}

function paramsDocument(params: TextDocumentPositionParams | DocumentSymbolParams, services: LangiumServices): LangiumDocument | undefined {
    const uri = URI.parse(params.textDocument.uri);
    return services.documents.LangiumDocuments.getOrCreateDocument(uri);
}
