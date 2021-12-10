/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    Connection, NotificationType
} from 'vscode-languageserver';
import { ActionMessage } from 'sprotty-protocol';
import { OperationCancelled } from 'langium';
import { LangiumSprottySharedServices } from './sprotty-services';

export namespace DiagramActionNotification {
    export const type = new NotificationType<ActionMessage>('diagram/accept');
}

export namespace DiagramDidCloseNotification {
    export const type = new NotificationType<string>('diagram/didClose');
}

/**
 * Adds JSON-RPC handlers for `DiagramActionNotification` and `DiagramDidCloseNotification` received
 * from the client.
 */
export function addDiagramHandler(connection: Connection, services: LangiumSprottySharedServices): void {
    const diagramServerManager = services.diagram.DiagramServerManager;
    connection.onNotification(DiagramActionNotification.type, message => {
        diagramServerManager.acceptAction(message)
            .catch(err => {
                if (err !== OperationCancelled) {
                    console.error('Error: ', err);
                }
            });
    });
    connection.onNotification(DiagramDidCloseNotification.type, clientId => {
        diagramServerManager.removeClient(clientId);
    });
}
