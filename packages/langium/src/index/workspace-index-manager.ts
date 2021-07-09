/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { WorkspaceFolder } from 'vscode-languageserver';
import { LangiumDocument, LangiumDocumentConfiguration } from '../documents/document';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';

export interface IndexManager {
    // initialize(workspace: RemoteWorkspace): void;
    initializeRoot(rootUri: string): void;
    initializeWorspace(folders: WorkspaceFolder[] | null): void;
    update(document: LangiumDocument): void;
    /* Use stream? */
    allElements(): AstNodeDescription[];
}

// don't know how to trac this.simpleIndex inside DefaultIndexManager
export class DefaultIndexManager implements IndexManager {
    protected readonly services: LangiumServices

    simpleIndex: Map<string, AstNodeDescription[]> = new Map<string, AstNodeDescription[]>();

    constructor(services: LangiumServices) {
        this.services = services;
    }

    allElements(): AstNodeDescription[] {
        const allDescriptions: AstNodeDescription[] = [];
        for (const astNodeDesc of this.simpleIndex.values()) {
            allDescriptions.push(...astNodeDesc);
        }
        return allDescriptions;
    }

    initializeRoot(rootUri: string): void {
        console.log('Root update request for: ' + rootUri);
        this.traverseFolder(fileURLToPath(rootUri), 'langium');
    }
    update(document: LangiumDocument): void {
        console.log('Update request for: ' + document.uri);
        this.processDocument(document);
    }

    initializeWorspace(folders: WorkspaceFolder[] | null): void {
        folders?.forEach((folder) => {
            this.traverseFolder(fileURLToPath(folder.uri), 'langium');
        });
    }

    /* sync access for now */
    protected traverseFolder(folderPath: string, fileExt: string): void {
        if (!existsSync(folderPath)) {
            console.error(`File ${folderPath} doesn't exist.`);
            return;
        }
        const subFolders = readdirSync(folderPath, { withFileTypes: true });
        for (const dirent of subFolders) {
            const res = resolve(folderPath, dirent.name);
            if (dirent.isDirectory()) {
                this.traverseFolder(res, fileExt);
            } else if (res.endsWith(fileExt)) {
                this.processLanguageFile(res);
            }
        }
    }

    protected processLanguageFile(filePath: string): void {
        // TODO check open not dirty documents first
        const fileContent = readFileSync(filePath).toString();
        const document = LangiumDocumentConfiguration.create(pathToFileURL(filePath).toString(), 'langium', 0, fileContent);
        this.processDocument(document);
    }

    protected processDocument(document: LangiumDocument): void {
        if (!document.precomputedScopes) {
            this.services.documents.DocumentBuilder.build(document);
            this.services.references.ScopeComputation.computeScope(document);
        }
        if (document.precomputedScopes) {
            let indexData: AstNodeDescription[] = [];
            for (const data of document.precomputedScopes?.values()) {
                indexData = data;
            }
            this.simpleIndex.set(document.uri, indexData);
        }
    }
}

export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}