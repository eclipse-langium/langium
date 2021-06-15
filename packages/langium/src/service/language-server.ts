import {
    InitializeParams, TextDocumentPositionParams, TextDocumentSyncKind, InitializeResult, Connection, CompletionList,
    ReferenceParams, Location
} from 'vscode-languageserver/node';

import { LangiumDocument } from '../documents/document';
import { LangiumServices } from '../services';

export function startLanguageServer(services: LangiumServices): void {
    const connection = services.languageServer.Connection;
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
                referencesProvider: {} // TODO enable workDoneProgress?
            }
        };
        if (hasWorkspaceFolderCapability) {
            result.capabilities.workspace = {
                workspaceFolders: {
                    supported: true
                }
            };
        }
        return result;
    });

    const documents = services.documents.TextDocuments;
    const documentBuilder = services.documents.DocumentBuilder;
    documents.onDidChangeContent(change => {
        documentBuilder.build(change.document);
    });

    addCompletionHandler(connection, services);
    addFindReferencesHandler(connection, services);

    // Make the text document manager listen on the connection for open, change and close text document events.
    documents.listen(connection);

    // Listen on the connection.
    connection.listen();
}

export function addCompletionHandler(connection: Connection, services: LangiumServices): void {
    // TODO create an extensible service API for completion
    connection.onCompletion(
        (_textDocumentPosition: TextDocumentPositionParams): CompletionList => {
            const uri = _textDocumentPosition.textDocument.uri;
            const document = services.documents.TextDocuments.get(uri);
            if (document) {
                const text = document.getText();
                const offset = document.offsetAt(_textDocumentPosition.position);
                const parser = services.Parser;
                const parseResult = parser.parse(text);
                const rootNode = parseResult.value;
                (rootNode as { $document: LangiumDocument }).$document = document;
                document.parseResult = parseResult;
                document.precomputedScopes = services.references.ScopeComputation.computeScope(rootNode);
                const completionProvider = services.completion.CompletionProvider;
                const assist = completionProvider.getCompletion(rootNode, offset);
                return assist;
            } else {
                return CompletionList.create();
            }
        }
    );
}

function addFindReferencesHandler(connection: Connection, services: LangiumServices): void {
    const referenceFinder = services.references.ReferenceFinder;
    connection.onReferences((params: ReferenceParams): Location[] => {
        const uri = params.textDocument.uri;
        const document = services.documents.TextDocuments.get(uri);
        if (document) {
            return referenceFinder.findReferences(document, params.position, params.context.includeDeclaration);
        } else {
            return [];
        }
    });
}