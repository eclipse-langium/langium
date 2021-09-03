/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { existsSync, readdirSync } from 'fs';
import { extname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { WorkspaceFolder } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { LanguageMetaData } from '../grammar/language-meta-data';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNodeReferenceDescription } from './ast-descriptions';

export interface IndexManager {
    initializeRoot(rootUri: string): void;
    initializeWorkspace(folders: WorkspaceFolder[] | null): void;
    update(document: LangiumDocument): void;
    /* Use streams? */
    allElements(): AstNodeDescription[];
    documentDescriptions(): ReadonlyMap<string, AstNodeReferenceDescription[]>;
}

// don't know how to trac this.simpleIndex inside DefaultIndexManager
export class DefaultIndexManager implements IndexManager {
    protected readonly services: LangiumServices
    protected readonly langMetaData: LanguageMetaData

    simpleIndex: Map<string, AstNodeDescription[]> = new Map<string, AstNodeDescription[]>();
    referenceIndex: Map<string, AstNodeReferenceDescription[]> = new Map<string, AstNodeReferenceDescription[]>();

    constructor(services: LangiumServices) {
        this.services = services;
        this.langMetaData = this.services.LanguageMetaData;
    }

    documentDescriptions(): ReadonlyMap<string, AstNodeReferenceDescription[]> {
        return this.referenceIndex;
    }

    allElements(): AstNodeDescription[] {
        const allDescriptions: AstNodeDescription[] = [];
        for (const astNodeDesc of this.simpleIndex.values()) {
            allDescriptions.push(...astNodeDesc);
        }
        return allDescriptions;
    }

    initializeRoot(rootUri: string): void {
        this.traverseFolder(fileURLToPath(rootUri), this.langMetaData.fileExtensions);
    }

    update(document: LangiumDocument): void {
        const taskName = this.langMetaData.languageId + ' - Document indexing for: ' + document.textDocument.uri.split('/').pop();
        console.time(taskName);
        this.processDocument(document);
        console.timeEnd(taskName);
    }

    initializeWorkspace(folders: WorkspaceFolder[] | null): void {
        const taskName = this.langMetaData.languageId + ' - Workspace indexing.';
        console.time(taskName);
        folders?.forEach((folder) => {
            this.traverseFolder(fileURLToPath(folder.uri), this.langMetaData.fileExtensions);
        });
        console.timeEnd(taskName);
    }

    /* sync access for now */
    protected traverseFolder(folderPath: string, fileExt: string[]): void {
        if (!existsSync(folderPath)) {
            console.error(`File ${folderPath} doesn't exist.`);
            return;
        }
        if (this.skip(folderPath))
            return;
        const subFolders = readdirSync(folderPath, { withFileTypes: true });
        for (const dir of subFolders) {
            const uri = resolve(folderPath, dir.name);
            if (dir.isDirectory()) {
                this.traverseFolder(uri, fileExt);
            } else if (fileExt.indexOf(extname(uri)) >= 0) {
                this.processLanguageFile(uri);
            }
        }
    }

    // do smart filtering here
    protected skip(filePath: string): boolean {
        return filePath.endsWith('node_modules')
            || filePath.endsWith('out');
    }

    protected processLanguageFile(uri: string): void {
        const fileUri = pathToFileURL(uri).toString();
        const document = this.services.documents.Documents.createOrGetDocument(fileUri);
        this.processDocument(document);
    }

    protected processDocument(document: LangiumDocument): void {
        const indexData: AstNodeDescription[] = this.services.index.AstNodeDescriptionProvider.createDescriptions(document);
        for (const data of indexData) {
            data.node = undefined; // clear reference to the AST Node
        }
        this.simpleIndex.set(document.textDocument.uri, indexData);
        this.referenceIndex.set(document.textDocument.uri, this.services.index.AstReferenceDescriptionProvider.createDescriptions(document));
    }
}
