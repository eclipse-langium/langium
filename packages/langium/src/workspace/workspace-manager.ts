/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, WorkspaceFolder } from 'vscode-languageserver';
import { URI, Utils } from 'vscode-uri';
import { ServiceRegistry } from '../service-registry';
import { LangiumSharedServices } from '../services';
import { interruptAndCheck, MutexLock } from '../utils/promise-util';
import { DocumentBuilder } from './document-builder';
import { LangiumDocument, LangiumDocuments } from './documents';
import { FileSystemNode, FileSystemProvider } from './file-system-provider';

/**
 * The workspace manager is responsible for finding source files in the workspace.
 * This service is shared between all languages of a language server.
 */
export interface WorkspaceManager {

    /**
     * Does the initial indexing of workspace folders.
     * Collects information about exported and referenced AstNodes in
     * each language file and stores it locally.
     *
     * @param folders The set of workspace folders to be indexed.
     */
    initializeWorkspace(folders: WorkspaceFolder[], cancelToken?: CancellationToken): Promise<void>;

}

export class DefaultWorkspaceManager implements WorkspaceManager {

    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly documentBuilder: DocumentBuilder;
    protected readonly fileSystemProvider: FileSystemProvider;
    protected readonly mutex: MutexLock;
    protected folders?: WorkspaceFolder[];

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.langiumDocuments = services.workspace.LangiumDocuments;
        this.documentBuilder = services.workspace.DocumentBuilder;
        this.fileSystemProvider = services.workspace.FileSystemProvider;
        this.mutex = services.workspace.MutexLock;

        services.lsp.LanguageServer.onInitialize(params => {
            this.folders = params.workspaceFolders ?? undefined;
        });

        services.lsp.LanguageServer.onInitialized(_params => {
            // Initialize the workspace even if there are no workspace folders
            // We still want to load additional documents (language library or similar) during initialization
            this.mutex.lock(token => this.initializeWorkspace(this.folders ?? [], token));
        });
    }

    async initializeWorkspace(folders: WorkspaceFolder[], cancelToken = CancellationToken.None): Promise<void> {
        const fileExtensions = this.serviceRegistry.all.flatMap(e => e.LanguageMetaData.fileExtensions);
        const documents: LangiumDocument[] = [];
        const collector = (document: LangiumDocument) => {
            documents.push(document);
            if (!this.langiumDocuments.hasDocument(document.uri)) {
                this.langiumDocuments.addDocument(document);
            }
        };
        // Even though we don't await the initialization of the workspace manager,
        // we can still assume that all library documents and file documents are loaded by the time we start building documents.
        // The mutex prevents anything from performing a workspace build until we check the cancellation token
        await this.loadAdditionalDocuments(folders, collector);
        await Promise.all(
            folders.map(wf => [wf, this.getRootFolder(wf)] as [WorkspaceFolder, URI])
                .map(async entry => this.traverseFolder(...entry, fileExtensions, collector))
        );
        // Only after creating all documents do we check whether we need to cancel the initialization
        // The document builder will later pick up on all unprocessed documents
        await interruptAndCheck(cancelToken);
        await this.documentBuilder.build(documents, undefined, cancelToken);
    }

    /**
     * Load all additional documents that shall be visible in the context of the given workspace
     * folders and add them to the collector. This can be used to include built-in libraries of
     * your language, which can be either loaded from provided files or constructed in memory.
     */
    protected loadAdditionalDocuments(_folders: WorkspaceFolder[], _collector: (document: LangiumDocument) => void): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Determine the root folder of the source documents in the given workspace folder.
     * The default implementation returns the URI of the workspace folder, but you can override
     * this to return a subfolder like `src` instead.
     */
    protected getRootFolder(workspaceFolder: WorkspaceFolder): URI {
        return URI.parse(workspaceFolder.uri);
    }

    /**
     * Traverse the file system folder identified by the given URI and its subfolders. All
     * contained files that match the file extensions are added to the collector.
     */
    protected async traverseFolder(workspaceFolder: WorkspaceFolder, folderPath: URI, fileExtensions: string[], collector: (document: LangiumDocument) => void): Promise<void> {
        const content = await this.fileSystemProvider.readDirectory(folderPath);
        await Promise.all(content.map(async entry => {
            if (this.includeEntry(workspaceFolder, entry, fileExtensions)) {
                if (entry.isDirectory) {
                    await this.traverseFolder(workspaceFolder, entry.uri, fileExtensions, collector);
                } else if (entry.isFile) {
                    const document = this.langiumDocuments.getOrCreateDocument(entry.uri);
                    collector(document);
                }
            }
        }));
    }

    /**
     * Determine whether the given folder entry shall be included while indexing the workspace.
     */
    protected includeEntry(workspaceFolder: WorkspaceFolder, entry: FileSystemNode, fileExtensions: string[]): boolean {
        const name = Utils.basename(entry.uri);
        if (name.startsWith('.')) {
            return false;
        }
        if (entry.isDirectory) {
            return name !== 'node_modules' && name !== 'out';
        } else if (entry.isFile) {
            const extname = Utils.extname(entry.uri);
            return fileExtensions.includes(extname);
        }
        return false;
    }

}
