/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DidChangeWatchedFilesNotification, FileChangeType, type DidChangeWatchedFilesParams, type DidChangeWatchedFilesRegistrationOptions, type TextDocumentChangeEvent } from 'vscode-languageserver';
import { stream } from '../utils/stream.js';
import { URI } from '../utils/uri-utils.js';
import type { DocumentBuilder } from '../workspace/document-builder.js';
import type { TextDocument } from '../workspace/documents.js';
import type { WorkspaceLock } from '../workspace/workspace-lock.js';
import type { LangiumSharedServices } from './lsp-services.js';
import type { WorkspaceManager } from '../workspace/workspace-manager.js';
import type { ServiceRegistry } from '../service-registry.js';

/**
 * Shared service for handling text document changes and watching relevant files.
 */
export interface DocumentUpdateHandler {

    /**
     * A content change event was triggered by the `TextDocuments` service.
     */
    didChangeContent(change: TextDocumentChangeEvent<TextDocument>): void;

    /**
     * The client detected changes to files and folders watched by the language client.
     */
    didChangeWatchedFiles(params: DidChangeWatchedFilesParams): void;

}

export class DefaultDocumentUpdateHandler implements DocumentUpdateHandler {

    protected readonly workspaceManager: WorkspaceManager;
    protected readonly documentBuilder: DocumentBuilder;
    protected readonly workspaceLock: WorkspaceLock;
    protected readonly serviceRegistry: ServiceRegistry;

    constructor(services: LangiumSharedServices) {
        this.workspaceManager = services.workspace.WorkspaceManager;
        this.documentBuilder = services.workspace.DocumentBuilder;
        this.workspaceLock = services.workspace.WorkspaceLock;
        this.serviceRegistry = services.ServiceRegistry;

        let canRegisterFileWatcher = false;
        services.lsp.LanguageServer.onInitialize(params => {
            canRegisterFileWatcher = Boolean(params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration);
        });

        services.lsp.LanguageServer.onInitialized(_params => {
            if (canRegisterFileWatcher) {
                this.registerFileWatcher(services);
            }
        });
    }

    protected registerFileWatcher(services: LangiumSharedServices): void {
        const fileExtensions = stream(services.ServiceRegistry.all)
            .flatMap(language => language.LanguageMetaData.fileExtensions)
            .map(ext => ext.startsWith('.') ? ext.substring(1) : ext)
            .distinct()
            .toArray();
        if (fileExtensions.length > 0) {
            const connection = services.lsp.Connection;
            const options: DidChangeWatchedFilesRegistrationOptions = {
                watchers: [{
                    globPattern: fileExtensions.length === 1
                        ? `**/*.${fileExtensions[0]}`
                        : `**/*.{${fileExtensions.join(',')}}`
                }]
            };
            connection?.client.register(DidChangeWatchedFilesNotification.type, options);
        }
    }

    protected fireDocumentUpdate(changed: URI[], deleted: URI[]): void {
        // Filter out URIs that do not have a service in the registry
        // Running the document builder update will fail for those URIs
        changed = changed.filter(uri => this.hasService(uri));
        // Only fire the document update when the workspace manager is ready
        // Otherwise, we might miss the initial indexing of the workspace
        this.workspaceManager.ready.then(() => {
            this.workspaceLock.write(token => this.documentBuilder.update(changed, deleted, token));
        }).catch(err => {
            // This should never happen, but if it does, we want to know about it
            console.error('Workspace initialization failed. Could not perform document update.', err);
        });
    }

    /**
     * Check whether the service registry contains a service instance for the given URI.
     *
     * Some language clients (vscode) decide to send update notifications for files that have been renamed to a different file extension.
     * In this case, the service registry may not contain a service for the new URI. We have to ignore any changes to those files.
     *
     * In case we only have a single language in our registry, we can safely use that language for all URIs.
     */
    protected hasService(uri: URI): boolean {
        try {
            this.serviceRegistry.getServices(uri);
            return true;
        } catch {
            return false;
        }
    }

    didChangeContent(change: TextDocumentChangeEvent<TextDocument>): void {
        this.fireDocumentUpdate([URI.parse(change.document.uri)], []);
    }

    didChangeWatchedFiles(params: DidChangeWatchedFilesParams): void {
        const changedUris = stream(params.changes)
            .filter(c => c.type !== FileChangeType.Deleted)
            .distinct(c => c.uri)
            .map(c => URI.parse(c.uri))
            .toArray();
        const deletedUris = stream(params.changes)
            .filter(c => c.type === FileChangeType.Deleted)
            .distinct(c => c.uri)
            .map(c => URI.parse(c.uri))
            .toArray();
        this.fireDocumentUpdate(changedUris, deletedUris);
    }

}
