/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from 'langium';
import { DiagramServer, DiagramServices } from 'sprotty-protocol';
import { DiagramServerManager } from './diagram-server-manager';

export type SprottyDiagramServices = {
    diagram: DiagramServices
}

export type DefaultSprottyServices = {
    diagram: {
        diagramServerFactory: (clientId: string) => DiagramServer,
        DiagramServerManager: DiagramServerManager
    }
}

export type LangiumSprottyServices = LangiumServices & SprottyDiagramServices & DefaultSprottyServices
