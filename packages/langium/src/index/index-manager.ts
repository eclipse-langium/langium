/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import path from 'path';
import { URI } from 'vscode-uri';
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
    /**
     * Does the initial indexing of workspace folders.
     * Collects information about exported and referenced AstNodes in
     * each language file and stores it locally.
     *
     * @param folders one or more workspace folders to be indexed. Does nothing if
     * the parameter is `null`
     */
    initializeWorkspace(folders: WorkspaceFolder[] | null): void;

    /**
     * Updates the information about a Document inside the index.
     *
     * @param document document to be updated
     */
    update(document: LangiumDocument): void;

    /**
     * @param nodeType The `AstNodeDescription.type` to filter with. Normally `AstNodeDescription.type` is equal to `AstNode.$type`
     * @returns a `Stream` of existing `AstNodeDescription`s filtered by their type
     */
    allElements(nodeType?: string): Stream<AstNodeDescription>;

    /**
     * Returns all known references that are pointing to the given `targetNode`.
     *
     * @param targetNode the `AstNode` to look up references for
     * @param astNodePath the path the points to the `targetNode` inside the document. See also `AstNodeLocator`
     *
     * @returns a `Stream` of references that are targeting the `targetNode`
     */
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

    findAllReferences(targetNode: AstNode, astNodePath: string): Stream<ReferenceDescription> {
        const targetDocUri = getDocument(targetNode).uri;
        const result: ReferenceDescription[] = [];
        this.referenceIndex.forEach((docRefs: ReferenceDescription[]) => {
            docRefs.forEach((refDescr) => {
                if (refDescr.targetUri.toString() === targetDocUri.toString() && refDescr.targetPath === astNodePath) {
                    result.push(refDescr);
                }
            });
        });
        return stream(result);
    }

    allElements(nodeType?: string): Stream<AstNodeDescription> {
        return stream(Array.from(this.simpleIndex.values()).flat().filter(e => nodeType ? this.astReflection.isSubtype(e.type, nodeType) : true));
    }

    update(document: LangiumDocument): void {
        this.processDocuments([document]);
    }

    initializeWorkspace(folders: WorkspaceFolder[] | null): void {
        const documents: LangiumDocument[] = [];
        const collector = (document: LangiumDocument) => {documents.push(document);};
        folders?.forEach((folder) => {
            this.traverseFolder(URI.parse(folder.uri), this.languageMetaData.fileExtensions, collector);
        });
        this.processDocuments(documents);
    }

    /* sync access for now */
    protected traverseFolder(folderPath: URI, fileExt: string[], documentAcceptor: (document: LangiumDocument) => void): void {
        const fsPath = folderPath.fsPath;
        if (!fs.existsSync(fsPath)) {
            console.error(`File ${folderPath} doesn't exist.`);
            return;
        }
        if (this.skip(folderPath))
            return;
        const subFolders = fs.readdirSync(fsPath, { withFileTypes: true });
        for (const dir of subFolders) {
            const uri = URI.file(path.resolve(fsPath, dir.name));
            if (dir.isDirectory()) {
                this.traverseFolder(uri, fileExt, documentAcceptor);
            } else if (fileExt.includes(path.extname(uri.path))) {
                const document = this.langiumDocuments().getOrCreateDocument(uri);
                documentAcceptor(document);
            }
        }
    }

    // do smart filtering here
    protected skip(filePath: URI): boolean {
        return filePath.path.endsWith('node_modules')
            || filePath.path.endsWith('out');
    }

    protected processDocuments(documents: LangiumDocument[]): void {
        // first: build exported object data
        documents.forEach((document) => {
            const indexData: AstNodeDescription[] = this.astNodeDescriptionProvider().createDescriptions(document);
            for (const data of indexData) {
                data.node = undefined; // clear reference to the AST Node
            }
            this.simpleIndex.set(document.textDocument.uri, indexData);
        });
        // second: link everything
        documents.forEach((document) => {
            this.referenceIndex.set(document.textDocument.uri, this.referenceDescriptionProvider().createDescriptions(document));
        });
    }
}
