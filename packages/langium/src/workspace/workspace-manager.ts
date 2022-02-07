/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import path from 'path';
import { WorkspaceFolder } from 'vscode-languageserver';
import { URI, Utils } from 'vscode-uri';
import { ServiceRegistry } from '../service-registry';
import { LangiumSharedServices } from '../services';
import { DocumentBuilder } from './document-builder';
import { LangiumDocument, LangiumDocuments } from './documents';

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

export class DefaultWorkspaceManager {

    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly documentBuilder: DocumentBuilder;

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.langiumDocuments = services.workspace.LangiumDocuments;
        this.documentBuilder = services.workspace.DocumentBuilder;
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
        const content = await this.getContent(folderPath);
        for (const entry of content) {
            if (this.includeEntry(entry, fileExtensions)) {
                const uri = Utils.resolvePath(folderPath, entry.name);
                if (entry.isDirectory) {
                    await this.traverseFolder(uri, fileExtensions, collector);
                } else if (entry.isFile) {
                    const document = this.langiumDocuments.getOrCreateDocument(uri);
                    collector(document);
                }
            }
        }
    }

    /**
     * Return the content metadata of the given folder. The default implementation reads this
     * metadata from the file system.
     */
    protected async getContent(folderPath: URI): Promise<FolderEntry[]> {
        const dirents = await fs.promises.readdir(folderPath.fsPath, { withFileTypes: true });
        return dirents.map(dirent => ({
            dirent, // Include the raw entry, it may be useful...
            get isFile() { return dirent.isFile(); },
            get isDirectory() { return dirent.isDirectory(); },
            name: dirent.name,
            container: folderPath
        }));
    }

    /**
     * Determine whether the given folder entry shall be included while indexing the workspace.
     */
    protected includeEntry(entry: FolderEntry, fileExtensions: string[]): boolean {
        if (entry.name.startsWith('.')) {
            return false;
        }
        if (entry.isDirectory) {
            return entry.name !== 'node_modules' && entry.name !== 'out';
        } else if (entry.isFile) {
            return fileExtensions.includes(path.extname(entry.name));
        }
        return false;
    }

}

export interface FolderEntry {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly name: string;
    readonly container: URI;
}
