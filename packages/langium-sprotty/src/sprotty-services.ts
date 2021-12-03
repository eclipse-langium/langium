/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from 'langium';
import { DiagramServer, DiagramServices } from 'sprotty-protocol';
import { DiagramServerManager } from './diagram-server-manager';

/**
 * Services required by the Sprotty diagram server to generate diagram models from a Langium AST.
 */
export type SprottyDiagramServices = {
    diagram: DiagramServices
}

/**
 * Services provided by the `DefaultSprottyModule` for the integration of Langium and Sprotty.
 */
export type DefaultSprottyServices = {
    diagram: {
        diagramServerFactory: (clientId: string) => DiagramServer,
        DiagramServerManager: DiagramServerManager
    }
}

/**
 * Extension of the `LangiumServices` with all services required for the integration of Langium and Sprotty.
 */
export type LangiumSprottyServices = LangiumServices & SprottyDiagramServices & DefaultSprottyServices
