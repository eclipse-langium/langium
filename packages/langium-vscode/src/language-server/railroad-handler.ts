/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, LangiumServices } from 'langium';
import { DocumentState } from 'langium';
import type { Connection} from 'vscode-languageserver';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DOCUMENTS_VALIDATED_NOTIFICATION, RAILROAD_DIAGRAM_REQUEST } from './messages';
import { createGrammarDiagramHtml } from 'langium-railroad';

export function registerRailroadConnectionHandler(connection: Connection, services: LangiumServices): void {
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    const documents = services.shared.workspace.LangiumDocuments;
    documentBuilder.onBuildPhase(DocumentState.Validated, documents => {
        const uris = documents.map(e => e.uri.toString());
        connection.sendNotification(DOCUMENTS_VALIDATED_NOTIFICATION, uris);
    });
    // After receiving the `DOCUMENTS_VALIDATED_NOTIFICATION`
    // the vscode extension will perform the following request
    connection.onRequest(RAILROAD_DIAGRAM_REQUEST, (uri: string) => {
        try {
            const parsedUri = URI.parse(uri);
            const document = documents.getOrCreateDocument(parsedUri);
            if (document.diagnostics?.some(e => e.severity === DiagnosticSeverity.Error)) {
                return undefined;
            }
            const generatedRailroadHtml = createGrammarDiagramHtml(document.parseResult.value as Grammar, {
                javascript: `const vscode = acquireVsCodeApi(); vscode.setState(${JSON.stringify(uri)});`
            });
            return generatedRailroadHtml;
        } catch {
            // Document couldn't be found or uri was invalid, just return nothing
            return undefined;
        }
    });
}
