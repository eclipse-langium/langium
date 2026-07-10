/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { AstChangedParams, InspectAstResult } from 'langium-inspector/protocol';
import { AST_CHANGED_NOTIFICATION, INSPECT_AST_REQUEST, isInspectAstError } from 'langium-inspector/protocol';

// Minimal interface we use from LanguageClient so we don't need to depend on the full type at runtime
interface InspectorClient {
    sendRequest(method: string, params: unknown): Promise<unknown>;
    onNotification(method: string, handler: (params: unknown) => void): { dispose(): void };
}

export interface PlainRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
}

export type InspectorState =
    | { kind: 'loading' }
    | { kind: 'update'; uri: string; languageId: string; ast: string }
    | { kind: 'error'; message: string }
    | { kind: 'clear'; message: string };

const INITIAL_STATE: InspectorState = {
    kind: 'clear',
    message: 'Open a DSL file supported by a Langium Inspector-enabled language server.'
};

/**
 * Owns the LSP-facing state behind the AST Inspector: registered per-language clients, the active
 * document, and the latest inspection result. Views subscribe to `onDidChangeState`/`onDidMoveCursor`
 * instead of talking to the language client directly, so a single request/notification flow feeds all of them.
 */
export class InspectorController implements vscode.Disposable {

    private readonly clients = new Map<string, InspectorClient>();
    private readonly notificationDisposables = new Map<string, { dispose(): void }>();
    private activeUri?: string;
    private activeLanguageId?: string;
    private state: InspectorState = INITIAL_STATE;

    private readonly stateEmitter = new vscode.EventEmitter<InspectorState>();
    readonly onDidChangeState = this.stateEmitter.event;

    private readonly cursorEmitter = new vscode.EventEmitter<{ uri: string; offset: number }>();
    readonly onDidMoveCursor = this.cursorEmitter.event;

    getState(): InspectorState {
        return this.state;
    }

    registerClient(client: LanguageClient, languageId: string): void {
        this.clients.set(languageId, client as unknown as InspectorClient);

        const disposable = client.onNotification(AST_CHANGED_NOTIFICATION, (params: unknown) => {
            const { uri } = params as AstChangedParams;
            if (uri === this.activeUri) {
                this.refreshAst(uri, languageId);
            }
        });
        this.notificationDisposables.get(languageId)?.dispose();
        this.notificationDisposables.set(languageId, disposable);

        // Refresh if the currently open editor uses this language
        if (this.activeLanguageId === languageId && this.activeUri) {
            this.refreshAst(this.activeUri, languageId);
        }
    }

    onActiveEditorChanged(editor: vscode.TextEditor): void {
        const langId = editor.document.languageId;
        const uri = editor.document.uri.toString();
        this.activeUri = uri;
        this.activeLanguageId = langId;

        if (this.clients.has(langId)) {
            this.refreshAst(uri, langId);
        } else {
            this.setState({ kind: 'clear', message: `No Langium Inspector registered for language: ${langId}` });
        }
    }

    onSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
        const uri = event.textEditor.document.uri.toString();
        if (uri !== this.activeUri) return;
        const offset = event.textEditor.document.offsetAt(event.selections[0].active);
        this.cursorEmitter.fire({ uri, offset });
    }

    async revealInEditor(uri: string, range: PlainRange): Promise<void> {
        const target = vscode.Uri.parse(uri);
        const doc = await vscode.workspace.openTextDocument(target);
        const selection = new vscode.Range(
            new vscode.Position(range.start.line, range.start.character),
            new vscode.Position(range.end.line, range.end.character)
        );
        await vscode.window.showTextDocument(doc, { selection, preserveFocus: true });
    }

    private async refreshAst(uri: string, languageId: string): Promise<void> {
        const client = this.clients.get(languageId);
        if (!client) return;
        this.setState({ kind: 'loading' });
        try {
            const result = await client.sendRequest(INSPECT_AST_REQUEST, { uri }) as InspectAstResult;
            if (isInspectAstError(result)) {
                this.setState({ kind: 'error', message: result.error });
            } else {
                this.setState({ kind: 'update', uri: result.uri, languageId: result.languageId, ast: result.ast });
            }
        } catch (e) {
            this.setState({ kind: 'error', message: String(e) });
        }
    }

    private setState(state: InspectorState): void {
        this.state = state;
        this.stateEmitter.fire(state);
    }

    dispose(): void {
        this.stateEmitter.dispose();
        this.cursorEmitter.dispose();
        for (const disposable of this.notificationDisposables.values()) {
            disposable.dispose();
        }
    }
}
