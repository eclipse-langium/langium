/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import type { LangiumInspectorApi } from 'langium-inspector/protocol';
import { registerRailroadWebview } from './railroad-webview.js';
import { AstTreeProvider } from './ast-tree-view.js';
import type { AstTreeNode } from './ast-tree-view.js';
import { InspectorController } from './inspector-controller.js';

let client: LanguageClient;

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
    const controller = new InspectorController();
    const treeProvider = new AstTreeProvider(controller);
    const treeView = vscode.window.createTreeView<AstTreeNode>(AstTreeProvider.viewId, { treeDataProvider: treeProvider });
    treeProvider.attachView(treeView);

    context.subscriptions.push(
        controller,
        treeProvider,
        treeView,

        vscode.commands.registerCommand('langium-inspector.show', () => {
            vscode.commands.executeCommand('langium-inspector.astTreeView.focus');
        }),

        vscode.commands.registerCommand('langium-inspector.revealNode', (node: AstTreeNode) => {
            if (node.uri && node.range) {
                void controller.revealInEditor(node.uri, node.range);
            }
        }),

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                controller.onActiveEditorChanged(editor);
            }
        }),

        vscode.window.onDidChangeTextEditorSelection(event => {
            controller.onSelectionChanged(event);
        })
    );

    // Refresh for the currently active editor if already open
    if (vscode.window.activeTextEditor) {
        controller.onActiveEditorChanged(vscode.window.activeTextEditor);
    }

    return {
        registerLangiumInspector: (client, languageId) => controller.registerClient(client, languageId)
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
