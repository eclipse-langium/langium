/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DocumentState, GrammarAST, URI, type Grammar } from 'langium';
import { createGrammarDiagramHtml } from 'langium-railroad';
import { expandToString } from 'langium/generate';
import { resolveTransitiveImports } from 'langium/grammar';
import type { LangiumServices } from 'langium/lsp';
import type { Connection } from 'vscode-languageserver';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { DOCUMENTS_VALIDATED_NOTIFICATION, RAILROAD_DIAGRAM_REQUEST } from './messages.js';

export function registerRailroadConnectionHandler(connection: Connection, services: LangiumServices): void {
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    const documents = services.shared.workspace.LangiumDocuments;
    documentBuilder.onBuildPhase(DocumentState.Validated, documents => {
        const uris = documents.map(e => e.uri.toString());
        connection.sendNotification(DOCUMENTS_VALIDATED_NOTIFICATION, uris);
    });
    // After receiving the `DOCUMENTS_VALIDATED_NOTIFICATION`
    // the vscode extension will perform the following request
    connection.onRequest(RAILROAD_DIAGRAM_REQUEST, async (uri: string) => {
        try {
            const parsedUri = URI.parse(uri);
            const document = await documents.getOrCreateDocument(parsedUri);
            if (document.diagnostics?.some(e => e.severity === DiagnosticSeverity.Error)) {
                return undefined;
            }
            const grammar = document.parseResult.value as Grammar;
            const importedGrammars = resolveTransitiveImports(documents, grammar);
            // Map all local and imported parser rules into a single array
            const parserRules = [grammar, ...importedGrammars].flatMap(g => g.rules).filter(GrammarAST.isParserRule);
            const generatedRailroadHtml = createGrammarDiagramHtml(Array.from(parserRules), {
                // Setting the state to the current uri allows us to open the webview on vscode restart
                javascript: expandToString`
                    const vscode = acquireVsCodeApi();
                    vscode.setState(${JSON.stringify(uri)});
                `
            });
            return generatedRailroadHtml;
        } catch {
            // Document couldn't be found or uri was invalid, just return nothing
            return undefined;
        }
    });
}
