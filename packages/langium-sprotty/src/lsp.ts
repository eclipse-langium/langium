/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Connection } from 'vscode-languageserver';
import type { ActionMessage } from 'sprotty-protocol';
import type { LangiumSprottySharedServices } from './sprotty-services.js';
import { NotificationType } from 'vscode-languageserver';
import { isOperationCancelled } from 'langium';

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
                if (!isOperationCancelled(err)) {
                    console.error('Error: ', err);
                }
            });
    });
    connection.onNotification(DiagramDidCloseNotification.type, clientId => {
        diagramServerManager.removeClient(clientId);
    });
}
