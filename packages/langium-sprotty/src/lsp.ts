/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Connection } from 'vscode-languageserver';
import type { ActionMessage, DiagramState, SModelIndex } from 'sprotty-protocol';
import type { Location } from 'vscode-languageserver';
import type { LangiumSprottyServices, LangiumSprottySharedServices } from './sprotty-services.js';
import { AstUtils, CstUtils, isOperationCancelled } from 'langium';
import { findElement, FitToScreenAction, SelectAction, SelectAllAction } from 'sprotty-protocol';
import { NotificationType } from 'vscode-languageserver';

/**
 * Notification sent in both directions to transmit actions between server and client.
 */
export namespace DiagramActionNotification {
    export const type = new NotificationType<ActionMessage>('diagram/accept');
}

/**
 * Notification sent from the client to indicate that a diagram was closed.
 */
export namespace DiagramDidCloseNotification {
    export const type = new NotificationType<string>('diagram/didClose');
}

/**
 * Notification sent from the server to open a location in a text editor.
 */
export namespace OpenInTextEditorNotification {
    export const type = new NotificationType<OpenInTextEditorMessage>('diagram/openInTextEditor');
    export interface OpenInTextEditorMessage {
        location: Location
        forceOpen: boolean
    }
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

// TODO remove this when the index property has been added to sprotty-protocol
interface DSWithIndex extends DiagramState {
    index?: SModelIndex
}

/**
 * Adds an action handler for selection changes that sends notifications to the language client to open the corresponding
 * source regions in the text editor, if a trace is available.
 */
export function addDiagramSelectionHandler(services: LangiumSprottyServices): void {
    const traceProvider = services.diagram.TraceProvider;
    const nameProvider = services.references.NameProvider;
    const connection = services.shared.lsp.Connection;
    if (!connection) {
        return;
    }
    services.diagram.ServerActionHandlerRegistry.onAction(SelectAction.KIND, (action: SelectAction, state: DSWithIndex) => {
        if (action.selectedElementsIDs?.length === 1)  {
            const selectedElement = state.index?.getById(action.selectedElementsIDs[0])
                ?? findElement(state.currentRoot, action.selectedElementsIDs[0]);
            if (selectedElement) {
                const source = traceProvider.getSource(selectedElement);
                if (source && source.$cstNode) {
                    const nameNode = nameProvider.getNameNode(source);
                    connection.sendNotification(OpenInTextEditorNotification.type, {
                        location: {
                            uri: AstUtils.getDocument(source).uri.toString(),
                            range: (nameNode ?? source.$cstNode).range
                        },
                        forceOpen: false
                    });
                }
            }
        }
        return Promise.resolve();
    });
}

/**
 * Adds a listener for text position changes that sends actions to the diagram client to select the corresponding
 * target elements in the diagram, if a trace is available.
 */
export function addTextSelectionHandler(services: LangiumSprottyServices, options: { fitToScreen?: Partial<FitToScreenAction> | 'none' } = {}): void {
    const diagramServerManager = services.shared.diagram.DiagramServerManager;
    const traceProvider = services.diagram.TraceProvider;
    const grammarConfig = services.parser.GrammarConfig;
    services.diagram.PositionTracker.onPositionChanged((document, position) => {
        const diagramServers = diagramServerManager.findServersForUri(document.uri);
        if (diagramServers.length > 0) {
            const rootNode = document.parseResult.value.$cstNode;
            const offset = document.textDocument.offsetAt(position);
            const selectedToken = CstUtils.findDeclarationNodeAtOffset(rootNode, offset, grammarConfig.nameRegexp);
            const node = selectedToken?.astNode;
            if (node) {
                for (const diagramServer of diagramServers) {
                    const rootElement = diagramServer.state.currentRoot;
                    const target = traceProvider.getTarget(node, rootElement);
                    if (target) {
                        // Deselect all other elements
                        diagramServer.dispatch({
                            kind: SelectAllAction.KIND,
                            select: false
                        } satisfies SelectAllAction);
                        // Select the target element
                        diagramServer.dispatch({
                            kind: SelectAction.KIND,
                            selectedElementsIDs: [target.id],
                            deselectedElementsIDs: []
                        } satisfies SelectAction);
                        // Navigate to the target element
                        if (options.fitToScreen !== 'none') {
                            diagramServer.dispatch({
                                maxZoom: 1.0,
                                animate: true,
                                ...options.fitToScreen,
                                kind: FitToScreenAction.KIND,
                                elementIds: [target.id]
                            } satisfies FitToScreenAction);
                        }
                    }
                }
            }
        }
    });
}
