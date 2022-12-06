/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    CallHierarchyIncomingCallsParams,
    CallHierarchyOutgoingCallsParams,
    CancellationToken, Connection, Disposable, Emitter, Event, FileChangeType, HandlerResult, InitializedParams, InitializeParams, InitializeResult,
    LSPErrorCodes, RequestHandler, ResponseError, ServerRequestHandler, TextDocumentIdentifier, TextDocumentSyncKind
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { eagerLoad } from '../dependency-injection';
import { LangiumServices, LangiumSharedServices } from '../services';
import { isOperationCancelled } from '../utils/promise-util';
import { DocumentState, LangiumDocument } from '../workspace/documents';
import { DefaultSemanticTokenOptions } from './semantic-token-provider';
import { mergeSignatureHelpOptions } from './signature-help-provider';

export interface LanguageServer {
    initialize(params: InitializeParams): Promise<InitializeResult>
    initialized(params: InitializedParams): Promise<void>
    onInitialize(callback: (params: InitializeParams) => void): Disposable
    onInitialized(callback: (params: InitializedParams) => void): Disposable
}

export class DefaultLanguageServer implements LanguageServer {

    protected onInitializeEmitter = new Emitter<InitializeParams>();
    protected onInitializedEmitter = new Emitter<InitializedParams>();

    protected readonly services: LangiumSharedServices;

    constructor(services: LangiumSharedServices) {
        this.services = services;
    }

    get onInitialize(): Event<InitializeParams> {
        return this.onInitializeEmitter.event;
    }

    get onInitialized(): Event<InitializedParams> {
        return this.onInitializedEmitter.event;
    }

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.eagerLoadServices();
        this.onInitializeEmitter.fire(params);
        this.onInitializeEmitter.dispose();
        return this.buildInitializeResult(params);
    }

    /**
     * Eagerly loads all services before emitting the `onInitialize` event.
     * Ensures that all services are able to catch the event.
     */
    protected eagerLoadServices(): void {
        eagerLoad(this.services);
        this.services.ServiceRegistry.all.forEach(language => eagerLoad(language));
    }

    protected hasService(callback: (language: LangiumServices) => object | undefined): boolean {
        return this.services.ServiceRegistry.all.some(language => callback(language) !== undefined);
    }

    protected buildInitializeResult(_params: InitializeParams): InitializeResult {
        const languages = this.services.ServiceRegistry.all;
        const hasFormattingService = this.hasService(e => e.lsp.Formatter);
        const formattingOnTypeOptions = languages.map(e => e.lsp.Formatter?.formatOnTypeOptions).find(e => Boolean(e));
        const hasCodeActionProvider = this.hasService(e => e.lsp.CodeActionProvider);
        const hasSemanticTokensProvider = this.hasService(e => e.lsp.SemanticTokenProvider);
        const commandNames = this.services.lsp.ExecuteCommandHandler?.commands;
        const documentLinkProvider = this.services.lsp.DocumentLinkProvider;
        const signatureHelpOptions = mergeSignatureHelpOptions(languages.map(e => e.lsp.SignatureHelp?.signatureHelpOptions));
        const hasGoToTypeProvider = this.hasService(e => e.lsp.TypeProvider);
        const hasGoToImplementationProvider = this.hasService(e => e.lsp.ImplementationProvider);
        const hasCompletionProvider = this.hasService(e => e.lsp.CompletionProvider);
        const hasReferencesProvider = this.hasService(e => e.lsp.ReferencesProvider);
        const hasDocumentSymbolProvider = this.hasService(e => e.lsp.DocumentSymbolProvider);
        const hasDefinitionProvider = this.hasService(e => e.lsp.DefinitionProvider);
        const hasDocumentHighlightProvider = this.hasService(e => e.lsp.DocumentHighlightProvider);
        const hasFoldingRangeProvider = this.hasService(e => e.lsp.FoldingRangeProvider);
        const hasHoverProvider = this.hasService(e => e.lsp.HoverProvider);
        const hasRenameProvider = this.hasService(e => e.lsp.RenameProvider);
        const hasCallHierarchyProvider = this.hasService(e => e.lsp.CallHierarchyProvider);
        const codeLensProvider = this.services.lsp.CodeLensProvider;
        const hasDeclarationProvider = this.hasService(e => e.lsp.DeclarationProvider);

        const result: InitializeResult = {
            capabilities: {
                workspace: {
                    workspaceFolders: {
                        supported: true
                    }
                },
                executeCommandProvider: commandNames && {
                    commands: commandNames
                },
                textDocumentSync: TextDocumentSyncKind.Incremental,
                completionProvider: hasCompletionProvider ? {} : undefined,
                referencesProvider: hasReferencesProvider,
                documentSymbolProvider: hasDocumentSymbolProvider,
                definitionProvider: hasDefinitionProvider,
                typeDefinitionProvider: hasGoToTypeProvider,
                documentHighlightProvider: hasDocumentHighlightProvider,
                codeActionProvider: hasCodeActionProvider,
                documentFormattingProvider: hasFormattingService,
                documentRangeFormattingProvider: hasFormattingService,
                documentOnTypeFormattingProvider: formattingOnTypeOptions,
                foldingRangeProvider: hasFoldingRangeProvider,
                hoverProvider: hasHoverProvider,
                renameProvider: hasRenameProvider ? {
                    prepareProvider: true
                } : undefined,
                semanticTokensProvider: hasSemanticTokensProvider
                    ? DefaultSemanticTokenOptions
                    : undefined,
                signatureHelpProvider: signatureHelpOptions,
                implementationProvider: hasGoToImplementationProvider,
                callHierarchyProvider: hasCallHierarchyProvider
                    ? {}
                    : undefined,
                documentLinkProvider: documentLinkProvider
                    ? { resolveProvider: Boolean(documentLinkProvider.resolveDocumentLink) }
                    : undefined,
                codeLensProvider: codeLensProvider
                    ? { resolveProvider: Boolean(codeLensProvider.resolveCodeLens) }
                    : undefined,
                declarationProvider: hasDeclarationProvider
            }
        };

        return result;
    }

    async initialized(params: InitializedParams): Promise<void> {
        this.onInitializedEmitter.fire(params);
        this.onInitializedEmitter.dispose();
    }
}

export function startLanguageServer(services: LangiumSharedServices): void {
    const connection = services.lsp.Connection;
    if (!connection) {
        throw new Error('Starting a language server requires the languageServer.Connection service to be set.');
    }

    addDocumentsHandler(connection, services);
    addDiagnosticsHandler(connection, services);
    addCompletionHandler(connection, services);
    addFindReferencesHandler(connection, services);
    addDocumentSymbolHandler(connection, services);
    addGotoDefinitionHandler(connection, services);
    addGoToTypeDefinitionHandler(connection, services);
    addGoToImplementationHandler(connection, services);
    addDocumentHighlightsHandler(connection, services);
    addFoldingRangeHandler(connection, services);
    addFormattingHandler(connection, services);
    addCodeActionHandler(connection, services);
    addRenameHandler(connection, services);
    addHoverHandler(connection, services);
    addSemanticTokenHandler(connection, services);
    addExecuteCommandHandler(connection, services);
    addSignatureHelpHandler(connection, services);
    addCallHierarchyHandler(connection, services);
    addCodeLensHandler(connection, services);
    addDocumentLinkHandler(connection, services);
    addConfigurationChangeHandler(connection, services);
    addGoToDeclarationHandler(connection, services);

    connection.onInitialize(params => {
        return services.lsp.LanguageServer.initialize(params);
    });
    connection.onInitialized(params => {
        return services.lsp.LanguageServer.initialized(params);
    });

    // Make the text document manager listen on the connection for open, change and close text document events.
    const documents = services.workspace.TextDocuments;
    documents.listen(connection);

    // Start listening for incoming messages from the client.
    connection.listen();
}

export function addDocumentsHandler(connection: Connection, services: LangiumSharedServices): void {
    const documentBuilder = services.workspace.DocumentBuilder;
    const mutex = services.workspace.MutexLock;

    function onDidChange(changed: URI[], deleted: URI[]): void {
        mutex.lock(token => documentBuilder.update(changed, deleted, token));
    }

    const documents = services.workspace.TextDocuments;
    documents.onDidChangeContent(change => {
        onDidChange([URI.parse(change.document.uri)], []);
    });
    connection.onDidChangeWatchedFiles(params => {
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
            return services.lsp.CompletionProvider?.getCompletion(document, params, cancelToken);
        },
        services
    ));
}

export function addFindReferencesHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onReferences(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.ReferencesProvider?.findReferences(document, params, cancelToken),
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
        (services, document, params, cancelToken) => services.lsp.DocumentSymbolProvider?.getSymbols(document, params, cancelToken),
        services
    ));
}

export function addGotoDefinitionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDefinition(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.DefinitionProvider?.getDefinition(document, params, cancelToken),
        services
    ));
}

export function addGoToTypeDefinitionHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onTypeDefinition(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.TypeProvider?.getTypeDefinition(document, params, cancelToken),
        services
    ));
}

export function addGoToImplementationHandler(connection: Connection, services: LangiumSharedServices) {
    connection.onImplementation(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.ImplementationProvider?.getImplementation(document, params, cancelToken),
        services
    ));
}

export function addGoToDeclarationHandler(connection: Connection, services: LangiumSharedServices) {
    connection.onDeclaration(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.DeclarationProvider?.getDeclaration(document, params, cancelToken),
        services
    ));
}

export function addDocumentHighlightsHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDocumentHighlight(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.DocumentHighlightProvider?.getDocumentHighlight(document, params, cancelToken),
        services
    ));
}

export function addHoverHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onHover(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.HoverProvider?.getHoverContent(document, params, cancelToken),
        services
    ));
}

export function addFoldingRangeHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onFoldingRanges(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.FoldingRangeProvider?.getFoldingRanges(document, params, cancelToken),
        services
    ));
}

export function addFormattingHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDocumentFormatting(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.Formatter?.formatDocument(document, params, cancelToken),
        services
    ));
    connection.onDocumentRangeFormatting(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.Formatter?.formatDocumentRange(document, params, cancelToken),
        services
    ));
    connection.onDocumentOnTypeFormatting(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.Formatter?.formatDocumentOnType(document, params, cancelToken),
        services
    ));
}

export function addRenameHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onRenameRequest(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.RenameProvider?.rename(document, params, cancelToken),
        services
    ));
    connection.onPrepareRename(createRequestHandler(
        (services, document, params, cancelToken) => services.lsp.RenameProvider?.prepareRename(document, params, cancelToken),
        services
    ));
}

export function addSemanticTokenHandler(connection: Connection, services: LangiumSharedServices): void {
    const errorMessage = 'No semantic token provider registered';
    connection.languages.semanticTokens.on(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.SemanticTokenProvider) {
                return services.lsp.SemanticTokenProvider.semanticHighlight(document, params, cancelToken);
            }
            return new ResponseError<void>(0, errorMessage);
        },
        services
    ));
    connection.languages.semanticTokens.onDelta(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.SemanticTokenProvider) {
                return services.lsp.SemanticTokenProvider.semanticHighlightDelta(document, params, cancelToken);
            }
            return new ResponseError<void>(0, errorMessage);
        },
        services
    ));
    connection.languages.semanticTokens.onRange(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.SemanticTokenProvider) {
                return services.lsp.SemanticTokenProvider.semanticHighlightRange(document, params, cancelToken);
            }
            return new ResponseError<void>(0, errorMessage);
        },
        services
    ));
}
export function addConfigurationChangeHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onDidChangeConfiguration(change => {
        if (change.settings) {
            services.workspace.ConfigurationProvider.updateConfiguration(change);
        }
    });
}

export function addExecuteCommandHandler(connection: Connection, services: LangiumSharedServices): void {
    const commandHandler = services.lsp.ExecuteCommandHandler;
    if (commandHandler) {
        connection.onExecuteCommand(async (params, token) => {
            try {
                return await commandHandler.executeCommand(params.command, params.arguments ?? [], token);
            } catch (err) {
                return responseError(err);
            }
        });
    }
}

export function addDocumentLinkHandler(connection: Connection, services: LangiumSharedServices): void {
    const documentLinkProvider = services.lsp.DocumentLinkProvider;
    if (documentLinkProvider) {
        connection.onDocumentLinks(createServerRequestHandler(
            (_, document, params, cancelToken) => documentLinkProvider.getDocumentLinks(document, params, cancelToken),
            services
        ));
        // Make sure the function doesn't become undefined before actually executing it
        const resolveDocumentLink = documentLinkProvider.resolveDocumentLink?.bind(documentLinkProvider);
        if (resolveDocumentLink) {
            connection.onDocumentLinkResolve(async (documentLink, token) => {
                try {
                    return await resolveDocumentLink(documentLink, token);
                } catch (err) {
                    return responseError(err);
                }
            });
        }
    }
}

export function addSignatureHelpHandler(connection: Connection, services: LangiumSharedServices): void {
    connection.onSignatureHelp(createServerRequestHandler(
        (services, document, params, cancelToken) => services.lsp.SignatureHelp?.provideSignatureHelp(document, params, cancelToken),
        services
    ));
}

export function addCodeLensHandler(connection: Connection, services: LangiumSharedServices): void {
    const codeLensProvider = services.lsp.CodeLensProvider;
    if (codeLensProvider) {
        connection.onCodeLens(createServerRequestHandler(
            (_, document, params, cancelToken) => codeLensProvider.provideCodeLens(document, params, cancelToken),
            services
        ));
        const resolveCodeLens = codeLensProvider.resolveCodeLens?.bind(codeLensProvider);
        if (resolveCodeLens) {
            connection.onCodeLensResolve(async (codeLens, token) => {
                try {
                    return await resolveCodeLens(codeLens, token);
                } catch (err) {
                    return responseError(err);
                }
            });
        }
    }
}

export function addCallHierarchyHandler(connection: Connection, services: LangiumSharedServices): void {
    const errorMessage = 'No call hierarchy provider registered';
    connection.languages.callHierarchy.onPrepare(createServerRequestHandler(
        (services, document, params, cancelToken) => {
            if (services.lsp.CallHierarchyProvider) {
                return services.lsp.CallHierarchyProvider.prepareCallHierarchy(document, params, cancelToken) ?? null;
            }
            return new ResponseError<void>(0, errorMessage);
        },
        services
    ));

    connection.languages.callHierarchy.onIncomingCalls(createCallHierarchyRequestHandler(
        (services, params, cancelToken) => {
            if (services.lsp.CallHierarchyProvider) {
                return services.lsp.CallHierarchyProvider.incomingCalls(params, cancelToken) ?? null;
            }
            return new ResponseError<void>(0, errorMessage);
        },
        services
    ));

    connection.languages.callHierarchy.onOutgoingCalls(createCallHierarchyRequestHandler(
        (services, params, cancelToken) => {
            if (services.lsp.CallHierarchyProvider) {
                return services.lsp.CallHierarchyProvider.outgoingCalls(params, cancelToken) ?? null;
            }
            return new ResponseError<void>(0, errorMessage);
        },
        services
    ));
}

export function createCallHierarchyRequestHandler<P extends CallHierarchyIncomingCallsParams | CallHierarchyOutgoingCallsParams, R, PR, E = void>(
    serviceCall: (services: LangiumServices, params: P, cancelToken: CancellationToken) => HandlerResult<R, E>,
    sharedServices: LangiumSharedServices
): ServerRequestHandler<P, R, PR, E> {
    const serviceRegistry = sharedServices.ServiceRegistry;
    return async (params: P, cancelToken: CancellationToken) => {
        const uri = URI.parse(params.item.uri);
        const language = serviceRegistry.getServices(uri);
        if (!language) {
            console.error(`Could not find service instance for uri: '${uri.toString()}'`);
            throw new Error();
        }
        try {
            return await serviceCall(language, params, cancelToken);
        } catch (err) {
            return responseError<E>(err);
        }
    };
}

export function createServerRequestHandler<P extends { textDocument: TextDocumentIdentifier }, R, PR, E = void>(
    serviceCall: (services: LangiumServices, document: LangiumDocument, params: P, cancelToken: CancellationToken) => HandlerResult<R, E>,
    sharedServices: LangiumSharedServices
): ServerRequestHandler<P, R, PR, E> {
    const documents = sharedServices.workspace.LangiumDocuments;
    const serviceRegistry = sharedServices.ServiceRegistry;
    return async (params: P, cancelToken: CancellationToken) => {
        const uri = URI.parse(params.textDocument.uri);
        const language = serviceRegistry.getServices(uri);
        if (!language) {
            console.error(`Could not find service instance for uri: '${uri.toString()}'`);
            throw new Error();
        }
        const document = documents.getOrCreateDocument(uri);
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
    const documents = sharedServices.workspace.LangiumDocuments;
    const serviceRegistry = sharedServices.ServiceRegistry;
    return async (params: P, cancelToken: CancellationToken) => {
        const uri = URI.parse(params.textDocument.uri);
        const language = serviceRegistry.getServices(uri);
        if (!language) {
            console.error(`Could not find service instance for uri: '${uri.toString()}'`);
            return null;
        }
        const document = documents.getOrCreateDocument(uri);
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
    if (isOperationCancelled(err)) {
        return new ResponseError(LSPErrorCodes.RequestCancelled, 'The request has been cancelled.');
    }
    if (err instanceof ResponseError) {
        return err;
    }
    throw err;
}
