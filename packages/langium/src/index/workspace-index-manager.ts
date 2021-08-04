/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { existsSync, readdirSync, readFileSync } from 'fs';
import { extname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { WorkspaceFolder } from 'vscode-languageserver';
import { LangiumDocument, LangiumDocumentConfiguration } from '../documents/document';
import { LanguageMetaData } from '../grammar/language-meta-data';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNodeReferenceDescription } from './ast-descriptions';

export interface IndexManager {
    initializeRoot(rootUri: string): void;
    initializeWorspace(folders: WorkspaceFolder[] | null): void;
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
        const taskName = this.langMetaData.languageId + ' - Document indexing for: ' + document.uri.split('/').pop();
        console.time(taskName);
        this.processDocument(document);
        console.timeEnd(taskName);
    }

    initializeWorspace(folders: WorkspaceFolder[] | null): void {
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
        for (const dirent of subFolders) {
            const res = resolve(folderPath, dirent.name);
            if (dirent.isDirectory()) {
                this.traverseFolder(res, fileExt);
            } else if (fileExt.indexOf(extname(res)) >= 0) {
                this.processLanguageFile(res);
            }
        }
    }

    // do smart filtering here
    protected skip(filePath: string): boolean {
        return filePath.endsWith('node_modules')
            || filePath.endsWith('out');
    }

    protected processLanguageFile(filePath: string): void {
        // TODO check open not dirty documents first
        const fileContent = readFileSync(filePath).toString();
        const langId = this.langMetaData.languageId;
        const document = LangiumDocumentConfiguration.create(pathToFileURL(filePath).toString(), langId, 0, fileContent);
        this.processDocument(document);
    }

    protected processDocument(document: LangiumDocument): void {
        if (!document.precomputedScopes) {
            this.services.documents.DocumentBuilder.build(document);
            this.services.references.ScopeComputation.computeScope(document);
        }
        if (document.precomputedScopes) {
            const indexData: AstNodeDescription[] = this.services.index.AstNodeDescriptionProvider.createDescriptions(document);
            for (const data of indexData) {
                data.node = undefined; // clear reference to the AST Node
            }
            this.simpleIndex.set(document.uri, indexData);
            if (document.parseResult?.value) {
                const imports: AstNodeReferenceDescription[] = [];
                // TODO create reference descriptions using Linker.linkCandidates
                this.referenceIndex.set(document.uri, imports);
            }
        }
    }
}