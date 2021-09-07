/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'vscode-uri';
import { existsSync, readdirSync } from 'fs';
import { extname, resolve } from 'path';
import { WorkspaceFolder } from 'vscode-languageserver';
import { LangiumDocument, LangiumDocuments } from '../documents/document';
import { LanguageMetaData } from '../grammar/language-meta-data';
import { AstNodeDescription } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNodeDescriptionProvider, ReferenceDescription, ReferenceDescriptionProvider } from './ast-descriptions';
import { AstNode } from '../syntax-tree';
import { stream, Stream } from '../utils/stream';
import { getDocument } from '../utils/ast-util';
import { AstReflection } from '..';

export interface IndexManager {
    initializeRoot(rootUri: string): void;
    initializeWorkspace(folders: WorkspaceFolder[] | null): void;
    update(document: LangiumDocument): void;
    /* Use streams? */
    allElements(referenceType?: string): Stream<AstNodeDescription>;
    findAllReferences(targetNode: AstNode, astNodePath: string): Stream<ReferenceDescription>;
}

export class DefaultIndexManager implements IndexManager {

    protected readonly langiumDocuments: () => LangiumDocuments;
    protected readonly astNodeDescriptionProvider: () => AstNodeDescriptionProvider;
    protected readonly referenceDescriptionProvider: () => ReferenceDescriptionProvider;
    protected readonly languageMetaData: LanguageMetaData;
    protected readonly astReflection: AstReflection;

    simpleIndex: Map<string, AstNodeDescription[]> = new Map<string, AstNodeDescription[]>();
    referenceIndex: Map<string, ReferenceDescription[]> = new Map<string, ReferenceDescription[]>();

    constructor(services: LangiumServices) {
        this.astReflection = services.AstReflection;
        this.languageMetaData = services.LanguageMetaData;
        this.langiumDocuments = () => services.documents.LangiumDocuments;
        this.astNodeDescriptionProvider = () => services.index.AstNodeDescriptionProvider;
        this.referenceDescriptionProvider = () => services.index.ReferenceDescriptionProvider;
    }

    documentDescriptions(): ReadonlyMap<string, ReferenceDescription[]> {
        return this.referenceIndex;
    }

    findAllReferences(targetNode: AstNode, astNodePath: string): Stream<ReferenceDescription> {
        const targetDocUri = getDocument(targetNode).textDocument.uri;
        const result: ReferenceDescription[] = [];
        this.referenceIndex.forEach((docRefs: ReferenceDescription[]) => {
            docRefs.forEach((refDescr)=> {
                if(refDescr.targetUri === targetDocUri && refDescr.targetPath === astNodePath) {
                    result.push(refDescr);
                }
            });
        });
        return stream(result);
    }

    allElements(referenceType?: string): Stream<AstNodeDescription> {
        return stream(Array.from(this.simpleIndex.values()).flat().filter(e => referenceType ? this.astReflection.isSubtype(e.type, referenceType) : true));
    }

    update(document: LangiumDocument): void {
        this.processDocument(document);
    }

    initializeRoot(rootUri: string): void {
        this.traverseFolder(URI.parse(rootUri).fsPath, this.languageMetaData.fileExtensions);
    }

    initializeWorkspace(folders: WorkspaceFolder[] | null): void {
        const taskName = this.languageMetaData.languageId + ' - Workspace indexing.';
        console.time(taskName);
        folders?.forEach((folder) => {
            this.traverseFolder(URI.parse(folder.uri).fsPath, this.languageMetaData.fileExtensions);
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
            } else if (fileExt.includes(extname(uri))) {
                this.processLanguageFile(uri);
            }
        }
    }

    // do smart filtering here
    protected skip(filePath: string): boolean {
        return filePath.endsWith('node_modules')
            || filePath.endsWith('out');
    }

    protected processLanguageFile(filePath: string): void {
        const document = this.langiumDocuments().createOrGetDocument(URI.file(filePath).toString());
        this.processDocument(document);
    }

    protected processDocument(document: LangiumDocument): void {
        const indexData: AstNodeDescription[] = this.astNodeDescriptionProvider().createDescriptions(document);
        for (const data of indexData) {
            data.node = undefined; // clear reference to the AST Node
        }
        this.simpleIndex.set(document.textDocument.uri, indexData);
        this.referenceIndex.set(document.textDocument.uri, this.referenceDescriptionProvider().createDescriptions(document));
    }
}
