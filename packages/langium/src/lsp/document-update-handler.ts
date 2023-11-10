/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { DidChangeWatchedFilesParams, DidChangeWatchedFilesRegistrationOptions, TextDocumentChangeEvent } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LangiumSharedServices } from '../services.js';
import type { MutexLock } from '../utils/promise-util.js';
import type { DocumentBuilder } from '../workspace/document-builder.js';
import { DidChangeWatchedFilesNotification, FileChangeType } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { stream } from '../utils/stream.js';

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

    protected readonly documentBuilder: DocumentBuilder;
    protected readonly mutexLock: MutexLock;

    constructor(services: LangiumSharedServices) {
        this.documentBuilder = services.workspace.DocumentBuilder;
        this.mutexLock = services.workspace.MutexLock;

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
        this.mutexLock.lock(token => this.documentBuilder.update(changed, deleted, token));
    }

    didChangeContent(change: TextDocumentChangeEvent<TextDocument>): void {
        this.fireDocumentUpdate([URI.parse(change.document.uri)], []);
    }

    didChangeWatchedFiles(params: DidChangeWatchedFilesParams): void {
        const changedUris = params.changes.filter(c => c.type !== FileChangeType.Deleted).map(c => URI.parse(c.uri));
        const deletedUris = params.changes.filter(c => c.type === FileChangeType.Deleted).map(c => URI.parse(c.uri));
        this.fireDocumentUpdate(changedUris, deletedUris);
    }

}
