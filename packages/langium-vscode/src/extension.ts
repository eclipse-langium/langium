/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import { registerRailroadWebview } from './railroad-webview.js';
import { AstViewProvider } from './ast-view.js';

let client: LanguageClient;

export interface LangiumInspectorApi {
    registerLangiumInspector(client: LanguageClient, languageId: string): void;
}

// Called by vscode on activation event, see package.json "activationEvents"
export async function activate(context: vscode.ExtensionContext): Promise<LangiumInspectorApi> {
    client = await startLanguageClient(context);
    registerRailroadWebview(client);
    return registerAstInspector(context);
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

function registerAstInspector(context: vscode.ExtensionContext): LangiumInspectorApi {
    const provider = new AstViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            AstViewProvider.viewId,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        ),

        vscode.commands.registerCommand('langium-inspector.show', () => {
            vscode.commands.executeCommand('langium-inspector.astView.focus');
        }),

        vscode.commands.registerCommand('langium-inspector.register', (client: LanguageClient, languageId: string) => {
            provider.registerClient(client, languageId);
        }),

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                provider.onActiveEditorChanged(editor);
            }
        }),

        vscode.window.onDidChangeTextEditorSelection(event => {
            provider.onSelectionChanged(event);
        })
    );

    // Refresh for the currently active editor if already open
    if (vscode.window.activeTextEditor) {
        provider.onActiveEditorChanged(vscode.window.activeTextEditor);
    }

    return {
        registerLangiumInspector: (client: LanguageClient, languageId: string) => {
            provider.registerClient(client, languageId);
        }
    };
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const serverModule = context.asAbsolutePath('./out/language-server/main.cjs');
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging.
    // By setting `process.env.DEBUG_BREAK` to a truthy value, the language server will wait until a debugger is attached.
    const debugOptions = { execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for langium documents
        documentSelector: [{ scheme: 'file', language: 'langium' }]
    };

    // Create the language client and start the client.
    const client = new LanguageClient(
        'langium',
        'Langium',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    await client.start();
    return client;
}
