/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, Connection } from 'vscode-languageserver';
import type { ActionMessage, DiagramOptions, DiagramServer, RequestModelAction } from 'sprotty-protocol';
import type { LangiumDocument, ServiceRegistry, URI } from 'langium';
import type { LangiumSprottyServices, LangiumSprottySharedServices } from './sprotty-services.js';
import type { LangiumDiagramGeneratorArguments } from './diagram-generator.js';
import { isRequestAction, RejectAction } from 'sprotty-protocol';
import { DocumentState, UriUtils, interruptAndCheck, stream } from 'langium';
import { DiagramActionNotification } from './lsp.js';

/**
 * A `DiagramServer` instance can handle exactly one client diagram. The host application
 * can open multiple diagrams with different IDs. This service manages the `DiagramServer`
 * instances, creating one instance for each received `clientId` and discarding it when the
 * client closes the respective diagram.
 */
export interface DiagramServerManager {

    /**
     * Find the DiagramServer instances that match the given document URI.
     */
    findServersForUri(documentUri: URI): DiagramServer[];

    /**
     * Called when an action message is sent from the client to the server.
     */
    acceptAction(message: ActionMessage): Promise<void>;

    /**
     * The client application notified closing of a specific diagram client.
     */
    removeClient(clientId: string): void;

}

export class DefaultDiagramServerManager implements DiagramServerManager {

    protected readonly connection?: Connection;
    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly diagramServerFactory: (clientId: string, options?: DiagramOptions) => DiagramServer;
    protected readonly diagramServerMap: Map<string, DiagramServer> = new Map();

    protected changedUris: URI[] = [];
    protected outdatedDocuments: Map<LangiumDocument, DiagramServer[]> = new Map();

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
            const index = this.changedUris.findIndex(uri2 => UriUtils.equals(uri1, uri2));
            if (index >= 0) {
                this.changedUris.splice(index, 1);
            }
        });
    }

    /**
     * Listen to completed builds and trigger diagram updates accordingly.
     */
    protected documentsBuilt(built: LangiumDocument[], cancelToken: CancellationToken): Promise<void> {
        for (const document of built) {
            // Only consider documents that were previously marked as changed
            if (this.changedUris.some(uri => UriUtils.equals(uri, document.uri))) {
                // Track the document URIs to diagram servers via the `sourceUri` option sent with the `RequestModelAction`
                const servers = this.findServersForUri(document.uri);
                if (servers.length > 0) {
                    this.outdatedDocuments.set(document, servers);
                }
            }
        }
        this.changedUris = [];
        return this.updateDiagrams(this.outdatedDocuments, cancelToken);
    }

    protected async updateDiagrams(documents: Map<LangiumDocument, DiagramServer[]>, cancelToken: CancellationToken): Promise<void> {
        while (documents.size > 0) {
            await interruptAndCheck(cancelToken);
            const [firstEntry] = documents;
            const [document, diagramServers] = firstEntry;
            const language = this.serviceRegistry.getServices(document.uri) as LangiumSprottyServices;
            if (!language.diagram) {
                throw new Error(`The '${language.LanguageMetaData.languageId}' language does not support diagrams.`);
            }
            if (this.shouldUpdateDiagram(document, language)) {
                const diagramGenerator = language.diagram.DiagramGenerator;
                for (const diagramServer of diagramServers) {
                    const model = await diagramGenerator.generate(<LangiumDiagramGeneratorArguments>{
                        document,
                        options: diagramServer.state.options ?? {},
                        state: diagramServer.state,
                        cancelToken
                    });
                    // Send a model update without awaiting it (the promise is resolved when the update is finished)
                    diagramServer.updateModel(model).catch(err => console.error('Model update failed: ' + err));
                }
            }
            documents.delete(document);
        }
    }

    /**
     * Determine whether we should actually update the given document. The default implementation skips
     * updating if there are lexer errors or parser errors.
     */
    protected shouldUpdateDiagram(document: LangiumDocument, _language: LangiumSprottyServices): boolean {
        return document.parseResult.lexerErrors.length === 0 && document.parseResult.parserErrors.length === 0;
    }

    findServersForUri(documentUri: URI): DiagramServer[] {
        return stream(this.diagramServerMap.values())
            .filter(server => UriUtils.equals(documentUri, server.state.options?.sourceUri as string))
            .toArray();
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
