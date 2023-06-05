/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import { DOCUMENTS_VALIDATED_NOTIFICATION, RAILROAD_DIAGRAM_REQUEST } from './language-server/messages';

export function registerRailroadWebview(client: LanguageClient): void {
    vscode.commands.registerCommand('langium.showRailroadDiagram', (uri: vscode.Uri) => {
        RailroadDiagramPanel.createOrShow(client, uri);
    });
    client.onNotification(DOCUMENTS_VALIDATED_NOTIFICATION, (uris: string[]) => {
        if (RailroadDiagramPanel.current && uris.includes(RailroadDiagramPanel.current.uri)) {
            RailroadDiagramPanel.current.update();
        }
    });
}

export class RailroadDiagramPanel implements vscode.Disposable {

    uri: string;
    client: LanguageClient;
    panel: vscode.WebviewPanel;

    private disposables: vscode.Disposable[] = [];

    static current?: RailroadDiagramPanel;

    static viewType = 'railroadDiagram';

    static createOrShow(client: LanguageClient, fileUri: vscode.Uri): void {
        if (this.current) {
            this.current?.update(fileUri.toString());
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            RailroadDiagramPanel.viewType,
            'Railroad Diagram ' + getFileName(fileUri.path),
            vscode.ViewColumn.Beside,
        );
        this.current = new RailroadDiagramPanel(client, panel, fileUri);
        this.current.update();
    }

    constructor(client: LanguageClient, panel: vscode.WebviewPanel, uri: vscode.Uri) {
        this.uri = uri.toString();
        this.client = client;
        this.panel = panel;
        vscode.window.onDidChangeActiveTextEditor(e => {
            if (e?.document.uri.path.endsWith('.langium')) {
                this.update(e.document.uri.toString());
            }
        }, undefined, this.disposables);
        panel.onDidDispose(() => {
            this.dispose();
        }, undefined, this.disposables);
    }

    dispose() {
        RailroadDiagramPanel.current = undefined;
        this.disposables.forEach(e => e.dispose());
    }

    async update(uri?: string): Promise<void> {
        if (uri) {
            this.uri = uri;
        }
        try {
            this.panel.title = 'Railroad Diagram ' + getFileName(this.uri);
            const railroad: string | undefined = await this.client.sendRequest(RAILROAD_DIAGRAM_REQUEST, this.uri);
            if (railroad) {
                this.panel.webview.html = railroad;
            }
        } catch {
            // Failed updating the webview
            // It might already be disposed
        }
    }

}

function getFileName(uri: string): string {
    return uri.substring(uri.lastIndexOf('/') + 1);
}
