/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumSharedServices } from 'langium/lsp';
import { DocumentState, URI } from 'langium';
import type { AstChangedParams, InspectAstParams, InspectAstResult } from './protocol.js';
import { AST_CHANGED_NOTIFICATION, INSPECT_AST_REQUEST } from './protocol.js';

export * from './protocol.js';

export function addInspectorSupport(shared: LangiumSharedServices): void {
    const connection = shared.lsp.Connection;
    if (!connection) return;

    connection.onRequest(INSPECT_AST_REQUEST, async (params: InspectAstParams): Promise<InspectAstResult> => {
        const uri = URI.parse(params.uri);
        const doc = shared.workspace.LangiumDocuments.getDocument(uri);
        if (!doc) {
            return { uri: params.uri, error: 'Document not found. Open the file in the editor first.' };
        }
        await shared.workspace.DocumentBuilder.waitUntil(DocumentState.Validated, uri);
        const langServices = shared.ServiceRegistry.getServices(uri);
        const ast = langServices.serializer.JsonSerializer.serialize(doc.parseResult.value, {
            space: 2,
            textRegions: params.options?.textRegions ?? true,
            refText: params.options?.refText ?? true,
            sourceText: params.options?.sourceText ?? false,
            comments: params.options?.comments ?? false,
        });
        return {
            uri: params.uri,
            languageId: doc.textDocument.languageId,
            ast,
        };
    });

    shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, (docs) => {
        for (const doc of docs) {
            const params: AstChangedParams = { uri: doc.uri.toString() };
            connection.sendNotification(AST_CHANGED_NOTIFICATION, params);
        }
    });
}
