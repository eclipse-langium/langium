/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Module } from 'langium';
import type { PartialLangiumServices } from 'langium/lsp';
import type { DiagramOptions } from 'sprotty-protocol';
import type { LangiumSprottyServices, LangiumSprottySharedServices, SprottyDefaultServices, SprottySharedServices } from './sprotty-services.js';
import { DiagramServer } from 'sprotty-protocol';
import { ServerActionHandlerRegistry } from 'sprotty-protocol/lib/action-handler.js';
import { URI } from 'vscode-uri';
import { DefaultDiagramServerManager } from './diagram-server-manager.js';
import { DiagramActionNotification } from './lsp.js';
import { DefaultPositionTracker, TrackingDocumentHighlightProvider } from './position-tracker.js';
import { DefaultTraceProvider } from './trace-provider.js';
import { DefaultDiagnosticMarkerProvider } from './diagnostic-marker-provider.js';

export const SprottyDefaultModule: Module<LangiumSprottyServices, SprottyDefaultServices & PartialLangiumServices> = {
    diagram: {
        DiagnosticMarkerProvider: (services) => new DefaultDiagnosticMarkerProvider(services),
        PositionTracker: (services) => new DefaultPositionTracker(services),
        ServerActionHandlerRegistry: () => new ServerActionHandlerRegistry(),
        TraceProvider: (services) => new DefaultTraceProvider(services)
    },
    lsp: {
        DocumentHighlightProvider: (services) => new TrackingDocumentHighlightProvider(services)
    }
};

export const defaultDiagramServerFactory =
(services: LangiumSprottySharedServices): ((clientId: string, options?: DiagramOptions) => DiagramServer) => {
    const connection = services.lsp.Connection;
    const serviceRegistry = services.ServiceRegistry;
    return (clientId, options) => {
        const sourceUri = options?.sourceUri;
        if (!sourceUri) {
            throw new Error("Missing 'sourceUri' option in request.");
        }
        const language = serviceRegistry.getServices(URI.parse(sourceUri as string)) as LangiumSprottyServices;
        if (!language.diagram) {
            throw new Error(`The '${language.LanguageMetaData.languageId}' language does not support diagrams.`);
        }
        return new DiagramServer(async action => {
            connection?.sendNotification(DiagramActionNotification.type, { clientId, action });
        }, language.diagram);
    };
};

/**
 * Default implementations of shared services for the integration of Langium and Sprotty.
 */
export const SprottySharedModule: Module<LangiumSprottySharedServices, SprottySharedServices> = {
    diagram: {
        diagramServerFactory: defaultDiagramServerFactory,
        DiagramServerManager: (services) => new DefaultDiagramServerManager(services)
    }
};
