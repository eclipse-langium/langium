/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Module } from 'langium';
import { DiagramServer } from 'sprotty-protocol';
import { DefaultDiagramServerManager } from './diagram-server-manager';
import { DiagramActionNotification } from './lsp';
import { LangiumSprottyServices, DefaultSprottyServices } from './sprotty-services';

export const DefaultSprottyModule: Module<LangiumSprottyServices, DefaultSprottyServices> = {
    diagram: {
        diagramServerFactory: services => {
            const connection = services.lsp.Connection;
            return clientId => new DiagramServer(async action => {
                connection?.sendNotification(DiagramActionNotification.type, { clientId, action });
            }, services.diagram);
        },
        DiagramServerManager: services => new DefaultDiagramServerManager(services)
    }
};
