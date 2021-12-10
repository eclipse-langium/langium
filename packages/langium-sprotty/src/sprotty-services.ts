/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices, LangiumSharedServices } from 'langium';
import { DiagramOptions, DiagramServer, DiagramServices } from 'sprotty-protocol';
import { DiagramServerManager } from './diagram-server-manager';

/**
 * Services required by the Sprotty diagram server to generate diagram models from a Langium AST.
 */
export type SprottyDiagramServices = {
    diagram: DiagramServices
}

/**
 * Extension of the `LangiumServices` with the diagram-related services.
 */
export type LangiumSprottyServices = LangiumServices & SprottyDiagramServices

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
