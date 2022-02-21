/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import path from 'path';
import { WorkspaceFolder } from 'vscode-languageserver';
import { URI, Utils } from 'vscode-uri';
import { ServiceRegistry } from '../service-registry';
import { LangiumSharedServices } from '../services';
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
    initializeWorkspace(folders: WorkspaceFolder[]): Promise<void>;

}

export class DefaultWorkspaceManager implements WorkspaceManager {

    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly documentBuilder: DocumentBuilder;
    protected readonly fileSystemProvider: FileSystemProvider;

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.langiumDocuments = services.workspace.LangiumDocuments;
        this.documentBuilder = services.workspace.DocumentBuilder;
        this.fileSystemProvider = services.workspace.FileSystemProvider;
    }

    async initializeWorkspace(folders: WorkspaceFolder[]): Promise<void> {
        const fileExtensions = this.serviceRegistry.all.flatMap(e => e.LanguageMetaData.fileExtensions);
        const documents: LangiumDocument[] = [];
        const collector = (document: LangiumDocument) => documents.push(document);
        await Promise.all(
            folders.map(wf => this.getRootFolder(wf))
                .map(async rf => this.traverseFolder(rf, fileExtensions, collector))
        );
        await this.loadAdditionalDocuments(folders, collector);
        await this.documentBuilder.build(documents);
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
    protected async traverseFolder(folderPath: URI, fileExtensions: string[], collector: (document: LangiumDocument) => void): Promise<void> {
        const content = await this.fileSystemProvider.readDirectory(folderPath);
        for (const entry of content) {
            if (this.includeEntry(entry, fileExtensions)) {
                if (entry.isDirectory) {
                    await this.traverseFolder(entry.uri, fileExtensions, collector);
                } else if (entry.isFile) {
                    const document = this.langiumDocuments.getOrCreateDocument(entry.uri);
                    collector(document);
                }
            }
        }
    }

    /**
     * Determine whether the given folder entry shall be included while indexing the workspace.
     */
    protected includeEntry(entry: FileSystemNode, fileExtensions: string[]): boolean {
        const name = Utils.basename(entry.uri);
        if (name.startsWith('.')) {
            return false;
        }
        if (entry.isDirectory) {
            return name !== 'node_modules' && name !== 'out';
        } else if (entry.isFile) {
            return fileExtensions.includes(path.extname(name));
        }
        return false;
    }

}
