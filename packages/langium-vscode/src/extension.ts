/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';
import { registerRailroadWebview } from './railroad-webview.js';

let client: LanguageClient;

// Called by vscode on activation event, see package.json "activationEvents"
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    client = await startLanguageClient(context);
    registerRailroadWebview(client);
    // cs: TODO rework and update the template decoration feature, if feasible
    //  see also https://github.com/eclipse-langium/langium/issues/841
    // configureTemplateDecoration(context);
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
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

// TODO(@@dd): externalize extension config
const DELAY = 100; // delay in ms until a render can be cancelled on subsequent document changes

// cs: TODO
// @ts-expect-error: deactivated the usage of this feature for Langium v1.0 (https://github.com/eclipse-langium/langium/issues/841)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function configureTemplateDecoration(context: vscode.ExtensionContext) {
    // define decoration type
    const decorationType = vscode.window.createTextEditorDecorationType(decorationRenderOptions());

    // creates a cancelable decorator that delays the update
    const decorator = cancelableDecorator((editor) => editor.setDecorations(decorationType, createDecorations(editor.document)));

    // initiate first decoration
    decorator();

    // register editor & document change listeners
    vscode.window.onDidChangeActiveTextEditor(() => decorator(), null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(() => decorator(), null, context.subscriptions);
}

// internal type definitions
type Decorator = (editor: vscode.TextEditor) => void;
type CancelableDecorator = () => void;
type TimeoutID = ReturnType<typeof setTimeout>; // NodeJS.Timer (node) or number (browser)

// adds the ability to cancel decoration requests
function cancelableDecorator(decorator: Decorator, _delay = 500): CancelableDecorator {
    let timeout: TimeoutID | undefined; // works for window.setTimeout() & NodeJS
    return () => {
        const editor = vscode.window.activeTextEditor;
        timeout && clearTimeout(timeout);
        timeout = editor && setTimeout(() => decorator(editor), DELAY);
    };
}

// scans the document for decoratable regions and returns decorated ranges
function createDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
    // TODO(@@dd): change implementation
    const regEx = /(\S+)`([^`]*)`/g; // TODO(@@dd): consider comments, strings and string substitutions
    const text = document.getText();
    const decorations: vscode.DecorationOptions[] = [];
    let match: RegExpExecArray | null;
    while ((match = regEx.exec(text))) {
        const name = match[1];
        const nameIndex = match.index;
        if (isSmartTemplate(name, nameIndex)) {
            const text = match[2];
            const textIndex = nameIndex + name.length + 1;
            decorateText(document, decorations, text, textIndex);
        }
    }
    return decorations;
}

// TODO(@@dd): replace this heuristic with a proper grammar
function decorateText(document: vscode.TextDocument, decorations: vscode.DecorationOptions[], text: string, textIndex: number): void {
    const indentation = findIndentation(text);
    const regEx = /[^\r?\n]+/g;
    let match: RegExpExecArray | null;
    while ((match = regEx.exec(text))) {
        const startIndex = textIndex + match.index;
        const startPos = document.positionAt(startIndex + indentation);
        const endPos = document.positionAt(startIndex + match[0].trimEnd().length);
        if (startPos.isBefore(endPos)) {
            const range = new vscode.Range(startPos, endPos);
            decorations.push({ range });
        }
    }
}

// TODO(@@dd): find bug
function findIndentation(text: string): number {
    const indents = text.split(/[\r?\n]/g).map(line => line.trimEnd()).filter(line => line.length > 0).map(line => line.search(/\S|$/));
    const min = indents.length === 0 ? 0 : Math.min(...indents); // min(...[]) = min() = Infinity
    return Math.max(0, min);
}

function isSmartTemplate(name: string, index: number): boolean {
    // TODO(@@dd): check if symbol(name)'s type resolves to smart template
    return name === 'indent' && index !== -1;
}

// styling of a decorated range
function decorationRenderOptions(): vscode.DecorationRenderOptions {
    return { // TODO(@@dd): externalize extension config
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        light: {
            backgroundColor: 'rgba(0, 0, 0, 0.13)',
            overviewRulerColor: 'rgba(0, 0, 0, 0.13)'
        },
        dark: {
            backgroundColor: 'rgba(255, 255, 255, 0.13)',
            overviewRulerColor: 'rgba(255, 255, 255, 0.13)'
        }
    };
}
