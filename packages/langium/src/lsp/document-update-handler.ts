/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CreateFilesParams, DeleteFilesParams, DidChangeWatchedFilesParams, DidChangeWatchedFilesRegistrationOptions, FileOperationOptions, RenameFilesParams, TextDocumentChangeEvent, WorkspaceEdit} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LangiumSharedServices } from '../services.js';
import type { MaybePromise, MutexLock } from '../utils/promise-util.js';
import type { DocumentBuilder } from '../workspace/document-builder.js';
import { DidChangeWatchedFilesNotification, FileChangeType } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { stream } from '../utils/stream.js';

/**
 * Shared service for handling document changes such as content changes, file creation, file deletion, etc.
 * The interface methods are optional, so they are only registered if they are implemented.
 */
export interface DocumentUpdateHandler {

    /**
     * These options are reported to the client as part of the ServerCapabilities.
     */
    readonly fileOperationOptions?: FileOperationOptions;

    /**
     * A content change event was triggered by the `TextDocuments` service.
     */
    didChangeContent?(change: TextDocumentChangeEvent<TextDocument>): void;

    /**
     * The client detected changes to files and folders watched by the language client.
     */
    didChangeWatchedFiles?(params: DidChangeWatchedFilesParams): void;

    /**
     * Files were created from within the client.
     * This notification must be registered with the {@link fileOperationOptions}.
     */
    didCreateFiles?(params: CreateFilesParams): void;

    /**
     * Files were renamed from within the client.
     * This notification must be registered with the {@link fileOperationOptions}.
     */
    didRenameFiles?(params: RenameFilesParams): void;

    /**
     * Files were deleted from within the client.
     * This notification must be registered with the {@link fileOperationOptions}.
     */
    didDeleteFiles?(params: DeleteFilesParams): void;

    /**
     * Called before files are actually created as long as the creation is triggered from within
     * the client either by a user action or by applying a workspace edit.
     * This request must be registered with the {@link fileOperationOptions}.
     * @returns a WorkspaceEdit which will be applied to workspace before the files are created.
     */
    willCreateFiles?(params: CreateFilesParams): MaybePromise<WorkspaceEdit | null>;

    /**
     * Called before files are actually renamed as long as the rename is triggered from within
     * the client either by a user action or by applying a workspace edit.
     * This request must be registered with the {@link fileOperationOptions}.
     * @returns a WorkspaceEdit which will be applied to workspace before the files are renamed.
     */
    willRenameFiles?(params: RenameFilesParams): MaybePromise<WorkspaceEdit | null>;

    /**
     * Called before files are actually deleted as long as the deletion is triggered from within
     * the client either by a user action or by applying a workspace edit.
     * This request must be registered with the {@link fileOperationOptions}.
     * @returns a WorkspaceEdit which will be applied to workspace before the files are deleted.
     */
    willDeleteFiles?(params: DeleteFilesParams): MaybePromise<WorkspaceEdit | null>;

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
