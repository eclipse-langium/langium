/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumServices, LangiumSharedServices } from 'langium/lsp';
import type { DiagramOptions, DiagramServer, DiagramServices } from 'sprotty-protocol';
import type { ServerActionHandlerRegistry } from 'sprotty-protocol/lib/action-handler.js';
import type { DiagnosticMarkerProvider } from './diagnostic-marker-provider.js';
import type { DiagramServerManager } from './diagram-server-manager.js';
import type { PositionTracker } from './position-tracker.js';
import type { TraceProvider } from './trace-provider.js';

/**
 * Services required by the Sprotty diagram server to generate diagram models from a Langium AST.
 */
export type SprottyDiagramServices = {
    diagram: DiagramServices
}

/**
 * Services provided by default implementations of the Langium-Sprotty integration.
 */
export type SprottyDefaultServices = {
    diagram: {
        DiagnosticMarkerProvider: DiagnosticMarkerProvider
        PositionTracker: PositionTracker
        ServerActionHandlerRegistry: ServerActionHandlerRegistry
        TraceProvider: TraceProvider
    }
}

/**
 * Extension of the `LangiumServices` with the diagram-related services.
 */
export type LangiumSprottyServices = LangiumServices & SprottyDiagramServices & SprottyDefaultServices & {
    shared: LangiumSprottySharedServices
}

/**
 * Services provided by the `SprottySharedModule` for the integration of Langium and Sprotty.
 */
export type SprottySharedServices = {
    diagram: {
        diagramServerFactory: (clientId: string, options?: DiagramOptions) => DiagramServer,
        DiagramServerManager: DiagramServerManager
    }
}

/**
 * Extension of the `LangiumSharedServices` with the diagram-related shared services.
 */
export type LangiumSprottySharedServices = LangiumSharedServices & SprottySharedServices
