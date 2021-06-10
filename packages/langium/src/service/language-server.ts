import {
    InitializeParams, CompletionItem, TextDocumentPositionParams, TextDocumentSyncKind, InitializeResult, Connection
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
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
                completionProvider: {}
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

    // Make the text document manager listen on the connection for open, change and close text document events.
    documents.listen(connection);

    // Listen on the connection.
    connection.listen();
}

export function addCompletionHandler(connection: Connection, services: LangiumServices): void {
    // TODO create an extensible service API for completion
    connection.onCompletion(
        (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
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
                const assist = completionProvider.contentAssist(parser.grammarAccess.grammar, rootNode, offset);
                return Array.from(new Set<string>(assist))
                    .map(e => buildCompletionItem(document, offset, text, e));
            } else {
                return [];
            }
        }
    );
}

function buildCompletionItem(document: TextDocument, offset: number, content: string, completion: string): CompletionItem {
    let negativeOffset = 0;
    for (let i = completion.length; i > 0; i--) {
        const contentSub = content.substring(content.length - i);
        if (completion.startsWith(contentSub)) {
            negativeOffset = i;
            break;
        }
    }
    const start = document.positionAt(offset - negativeOffset);
    const end = document.positionAt(offset);
    return {
        label: completion,
        textEdit: {
            newText: completion,
            range: {
                start,
                end
            }
        }
    };
}
