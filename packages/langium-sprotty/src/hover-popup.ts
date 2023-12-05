/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { DiagramServer, DiagramState, HtmlRoot, PreRenderedElement, SModelElement, SModelIndex, SModelRoot } from 'sprotty-protocol';
import type { SDiagnosticMarker } from './diagnostic-marker-provider.js';
import type { LangiumSprottyServices } from './sprotty-services.js';
import { expandToString } from 'langium/generate';
import { findElement, RequestPopupModelAction, SetPopupModelAction } from 'sprotty-protocol';

// TODO remove this when the index property has been added to sprotty-protocol
interface DSWithIndex extends DiagramState {
    index?: SModelIndex
}

/**
 * Adds a handler for RequestPopupModelAction requests and configures a default response for diagnostic markers.
 * A custom popup model can be created by providing a function as second parameter.
 */
export function addHoverPopupHandler(services: LangiumSprottyServices, customPopupModel?: (element: SModelElement, request: RequestPopupModelAction, state: DiagramState) => SModelRoot | undefined): void {
    services.diagram.ServerActionHandlerRegistry.onAction(RequestPopupModelAction.KIND, (request: RequestPopupModelAction, state: DSWithIndex, server: DiagramServer) => {
        const element = state.index?.getById(request.elementId)
            ?? findElement(state.currentRoot, request.elementId);
        if (element) {
            if (customPopupModel) {
                const root = customPopupModel(element, request, state);
                if (root) {
                    return sendPopupModelResponse(root, request, server);
                }
            }
            if (element.type === 'marker' && (Array.isArray((element as SDiagnosticMarker).issues))) {
                const root: HtmlRoot = {
                    type: 'html',
                    id: `${element.id}-popup`,
                    children: [
                        <PreRenderedElement>{
                            type: 'pre-rendered',
                            id: `${element.id}-popup-body`,
                            code: generateDiagnosticInfo(element as SDiagnosticMarker)
                        }
                    ],
                    canvasBounds: request.bounds
                };
                return sendPopupModelResponse(root, request, server);
            }
        }
        return Promise.resolve();
    });
}

function sendPopupModelResponse(root: SModelRoot, request: RequestPopupModelAction, server: DiagramServer): Promise<void> {
    return server.dispatch({
        kind: SetPopupModelAction.KIND,
        newRoot: root,
        responseId: request.requestId
    } satisfies SetPopupModelAction);
}

function generateDiagnosticInfo(marker: SDiagnosticMarker): string {
    return expandToString`
    <div class="sprotty-infoBlock">
        <div class="sprotty-infoRow">
            ${marker.issues.map(issue => expandToString`
                <div class="sprotty-infoText">
                    <span class="sprotty-${issue.severity}">${issue.message}</span>
                </div>
            `).join()}
        </div>
    </div>
    `;
}
