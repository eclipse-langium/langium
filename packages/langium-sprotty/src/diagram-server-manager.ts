/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Connection } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { ActionMessage, DiagramOptions, DiagramServer, isRequestAction, RejectAction, RequestModelAction } from 'sprotty-protocol';
import { DocumentState, equalURI, interruptAndCheck, LangiumDocument, ServiceRegistry, stream } from 'langium';
import { LangiumSprottyServices, LangiumSprottySharedServices } from './sprotty-services';
import { LangiumDiagramGeneratorArguments } from './diagram-generator';
import { DiagramActionNotification } from './lsp';

/**
 * A `DiagramServer` instance can handle exactly one client diagram. The host application
 * can open multiple diagrams with different IDs. This service manages the `DiagramServer`
 * instances, creating one instance for each received `clientId` and discarding it when the
 * client closes the respective diagram.
 */
export interface DiagramServerManager {
    /**
     * Called when an action message is sent from the client to the server.
     */
    acceptAction(message: ActionMessage): Promise<void>

    /**
     * The client application notified closing of a specific diagram client.
     */
    removeClient(clientId: string): void
}

export class DefaultDiagramServerManager implements DiagramServerManager {

    protected readonly connection?: Connection;
    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly diagramServerFactory: (clientId: string, options?: DiagramOptions) => DiagramServer;
    protected readonly diagramServerMap: Map<string, DiagramServer> = new Map();

    private changedUris: URI[] = [];
    private outdatedDocuments: Map<LangiumDocument, DiagramServer> = new Map();

    constructor(services: LangiumSprottySharedServices) {
        this.connection = services.lsp.Connection;
        this.serviceRegistry = services.ServiceRegistry;
        this.diagramServerFactory = services.diagram.diagramServerFactory;
        services.workspace.DocumentBuilder.onUpdate((changed, deleted) => this.documentsUpdated(changed, deleted));
        services.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, (built, ct) => this.documentsBuilt(built, ct));
    }

    /**
     * Listen to incoming document change notifications and keep track of such changed documents.
     */
    protected documentsUpdated(changed: URI[], deleted: URI[]): void {
        this.changedUris.push(...changed);
        deleted.forEach(uri1 => {
            const index = this.changedUris.findIndex(uri2 => equalURI(uri1, uri2));
            if (index >= 0) {
                this.changedUris.splice(index, 1);
            }
        });
    }

    /**
     * Listen to completed builds and trigger diagram updates accordingly.
     */
    protected documentsBuilt(built: LangiumDocument[], cancelToken: CancellationToken): Promise<void> {
        stream(built)
            // Only consider documents that were previously marked as changed
            .filter(doc => this.changedUris.some(uri => equalURI(uri, doc.uri)))
            // Track the document URIs to diagram servers via the `sourceUri` option sent with the `RequestModelAction`
            .map(doc => <[LangiumDocument, DiagramServer]>[
                doc,
                stream(this.diagramServerMap.values()).find(server => doc.uri.toString() === server.state.options?.sourceUri)
            ])
            .forEach(entry => {
                if (entry[1]) {
                    this.outdatedDocuments.set(entry[0], entry[1]);
                }
            });
        this.changedUris = [];
        return this.updateDiagrams(this.outdatedDocuments, cancelToken);
    }

    protected async updateDiagrams(documents: Map<LangiumDocument, DiagramServer>, cancelToken: CancellationToken): Promise<void> {
        while (documents.size > 0) {
            await interruptAndCheck(cancelToken);
            const [firstEntry] = documents;
            const [document, diagramServer] = firstEntry;
            const language = this.serviceRegistry.getServices(document.uri) as LangiumSprottyServices;
            if (!language.diagram) {
                throw new Error(`The '${language.LanguageMetaData.languageId}' language does not support diagrams.`);
            }
            const diagramGenerator = language.diagram.DiagramGenerator;
            const model = await diagramGenerator.generate(<LangiumDiagramGeneratorArguments>{
                document,
                options: diagramServer.state.options ?? {},
                state: diagramServer.state,
                cancelToken
            });
            // Send a model update without awaiting it (the promise is resolved when the update is finished)
            diagramServer.updateModel(model).catch(err => console.error('Model update failed: ' + err));
            documents.delete(document);
        }
    }

    acceptAction({ clientId, action }: ActionMessage): Promise<void> {
        try {
            let diagramServer = this.diagramServerMap.get(clientId);
            if (!diagramServer) {
                const options = (action as RequestModelAction).options;
                diagramServer = this.diagramServerFactory(clientId, options);
                this.diagramServerMap.set(clientId, diagramServer);
            }
            return diagramServer.accept(action);
        } catch (err) {
            if (err instanceof Error && isRequestAction(action)) {
                const rejectAction: RejectAction = {
                    kind: RejectAction.KIND,
                    responseId: action.requestId,
                    message: err.message,
                    detail: err.stack
                };
                this.connection?.sendNotification(DiagramActionNotification.type, { clientId, action: rejectAction });
            }
            return Promise.reject(err);
        }
    }

    removeClient(clientId: string): void {
        this.diagramServerMap.delete(clientId);
    }
}
