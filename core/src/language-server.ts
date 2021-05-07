/* eslint-disable */
import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult
} from 'vscode-languageserver/node';

import * as langium from "./index";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { contentAssist } from './service/content-assist/content-assist-service';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const parser = new langium.Parser(new langium.LangiumGrammarAccess());
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
// let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;
    console.log("Initialize!");
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    // hasDiagnosticRelatedInformationCapability = !!(
    //     capabilities.textDocument &&
    //     capabilities.textDocument.publishDiagnostics &&
    //     capabilities.textDocument.publishDiagnostics.relatedInformation
    // );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
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
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

connection.onDidChangeConfiguration(change => {
    // Revalidate all open text documents
    // documents.all().forEach(validateTextDocument);
});

documents.onDidOpen(change => {
    // validateTextDocument(change.document);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    // validateTextDocument(change.document);
});

// async function validateTextDocument(textDocument: TextDocument): Promise<void> {

//     // The validator creates diagnostics for all uppercase words length 2 and more
//     let text = textDocument.getText();
//     const parseResult = parse(text);
//     if (parseResult.lexErrors.length > 0) {
//         return;
//     }

//     let diagnostics: Diagnostic[] = [];

//     for (const parserError of parseResult.parseErrors) {
//         const token = parserError.token;
//         let diagnostic: Diagnostic = {
//             severity: DiagnosticSeverity.Error,
//             range: {
//                 start: textDocument.positionAt(token.startOffset),
//                 end: textDocument.positionAt(token.startOffset + token.image.length)
//             },
//             message: parserError.message,
//             source: 'ex'
//         };
//         diagnostics.push(diagnostic);
//     }

//     // Send the computed diagnostics to VS Code.
//     connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
// }

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VS Code
    connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const uri = _textDocumentPosition.textDocument.uri;
        const document = documents.get(uri);
        if (document) {
            const text = document.getText({ start: document.positionAt(0), end: _textDocumentPosition.position });
            const offset = document.offsetAt(_textDocumentPosition.position);
            const assistResult = parser.parse(text).value;
            const assist = contentAssist(parser.grammarAccess['grammar'], assistResult, offset);
            return Array.from(new Set<string>(assist))
                .map(e => buildCompletionItem(document, offset, text, e));
        } else {
            return [];
        }
    }
);

function buildCompletionItem(document: TextDocument, offset: number, content: string, completion: string): CompletionItem {
    let negativeOffset: number = 0;
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

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();