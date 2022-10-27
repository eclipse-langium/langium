/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DiagramOptions, DiagramServer } from 'sprotty-protocol';
import { DefaultDiagramServerManager } from './diagram-server-manager';
import { DiagramActionNotification } from './lsp';
import { LangiumSprottyServices, LangiumSprottySharedServices, SprottySharedServices } from './sprotty-services';
import { URI } from 'vscode-uri';
import { Module } from 'djinject';

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
        DiagramServerManager: services => new DefaultDiagramServerManager(services)
    }
};
