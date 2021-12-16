/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import path from 'path';
import { CancellationToken, WorkspaceFolder } from 'vscode-languageserver';
import { URI, Utils } from 'vscode-uri';
import { ServiceRegistry } from '../service-registry';
import { LangiumSharedServices } from '../services';
import { AstNode, AstNodeDescription, AstReflection } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { interruptAndCheck } from '../utils/promise-util';
import { stream, Stream } from '../utils/stream';
import { ReferenceDescription } from './ast-descriptions';
import { DocumentState, LangiumDocument, LangiumDocuments } from './documents';

/**
 * The index manager is responsible for keeping metadata about symbols and cross-references
 * in the workspace. It is used to look up symbols in the global scope, mostly during linking
 * and completion.
 */
export interface IndexManager {

    /**
     * Does the initial indexing of workspace folders.
     * Collects information about exported and referenced AstNodes in
     * each language file and stores it locally.
     *
     * @param folders The set of workspace folders to be indexed.
     */
    initializeWorkspace(folders: WorkspaceFolder[]): Promise<void>;

    /**
     * Deletes the specified document uris from the index.
     * Necessary when documents are deleted and not referenceable anymore.
     *
     * @param uris The document uris to delete.
     */
    remove(uris: URI[]): void;

    /**
     * Updates the information about a Document inside the index.
     *
     * @param document document(s) to be updated
     * @param cancelToken allows to cancel the current operation
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    update(documents: LangiumDocument[], cancelToken?: CancellationToken): Promise<void>;

    /**
     * Returns all documents that could be affected by changes in the documents
     * identified by the given URIs.
     *
     * @param uris The document URIs which may affect other documents.
     */
    getAffectedDocuments(uris: URI[]): Stream<LangiumDocument>;

    /**
     * Compute a global scope, optionally filtered using a type identifier.
     *
     * @param nodeType The type to filter with, or `undefined` to return descriptions of all types.
     * @returns a `Stream` of existing `AstNodeDescription`s filtered by their type
     */
    allElements(nodeType?: string): Stream<AstNodeDescription>;

    /**
     * Returns all known references that are pointing to the given `targetNode`.
     *
     * @param targetNode the `AstNode` to look up references for
     * @param astNodePath the path that points to the `targetNode` inside the document. See also `AstNodeLocator`
     *
     * @returns a `Stream` of references that are targeting the `targetNode`
     */
    findAllReferences(targetNode: AstNode, astNodePath: string): Stream<ReferenceDescription>;

}

export class DefaultIndexManager implements IndexManager {

    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly langiumDocuments: () => LangiumDocuments;
    protected readonly astReflection: AstReflection;

    protected readonly simpleIndex: Map<string, AstNodeDescription[]> = new Map<string, AstNodeDescription[]>();
    protected readonly referenceIndex: Map<string, ReferenceDescription[]> = new Map<string, ReferenceDescription[]>();
    protected readonly globalScopeCache = new Map<string, AstNodeDescription[]>();

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.astReflection = services.AstReflection;
        this.langiumDocuments = () => services.workspace.LangiumDocuments;
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

    allElements(nodeType = ''): Stream<AstNodeDescription> {
        if (!this.globalScopeCache.has('')) {
            this.globalScopeCache.set('', Array.from(this.simpleIndex.values()).flat());
        }

        const cached = this.globalScopeCache.get(nodeType);
        if (cached) {
            return stream(cached);
        } else {
            const elements = this.globalScopeCache.get('')!.filter(e => this.astReflection.isSubtype(e.type, nodeType));
            this.globalScopeCache.set(nodeType, elements);
            return stream(elements);
        }
    }

    remove(uris: URI[]): void {
        for (const uri of uris) {
            const uriString = uri.toString();
            this.simpleIndex.delete(uriString);
            this.referenceIndex.delete(uriString);
        }
    }

    update(documents: LangiumDocument[], cancelToken = CancellationToken.None): Promise<void> {
        return this.processDocuments(documents, cancelToken);
    }

    getAffectedDocuments(uris: URI[]): Stream<LangiumDocument> {
        return this.langiumDocuments().all.filter(e => {
            if (uris.some(uri => e.uri.toString() === uri.toString())) {
                return false;
            }
            for (const uri of uris) {
                if (this.isAffected(e, uri)) {
                    return true;
                }
            }
            return false;
        });
    }

    /**
     * Determine whether the given document could be affected by a change of the document
     * identified by the given URI (second parameter).
     */
    protected isAffected(document: LangiumDocument, changed: URI): boolean {
        const changedUriString = changed.toString();
        const documentUri = document.uri.toString();
        // The document is affected if it contains linking errors
        if (document.references.some(e => e.error)) {
            return true;
        }
        const references = this.referenceIndex.get(documentUri);
        // ...or if it contains a reference to the changed file
        if (references) {
            return references.filter(e => !e.local).some(e => e.targetUri.toString() === changedUriString);
        }
        return false;
    }

    async initializeWorkspace(folders: WorkspaceFolder[]): Promise<void> {
        const documents: LangiumDocument[] = [];
        const allFileExtensions = this.serviceRegistry.all.flatMap(e => e.LanguageMetaData.fileExtensions);
        const fileFilter = (uri: URI) => allFileExtensions.includes(path.extname(uri.path));
        const collector = (document: LangiumDocument) => documents.push(document);
        await Promise.all(
            folders.map(folder => this.getRootFolder(folder))
                .map(async folderPath => this.traverseFolder(folderPath, fileFilter, collector))
        );
        await this.loadAdditionalDocuments(folders, collector);
        await this.processDocuments(documents);
    }

    /**
     * Load all additional documents that shall be visible in the context of the given workspace
     * folders and add them to the acceptor. This can be used to include built-in libraries of
     * your language, which can be either loaded from provided files or constructed in memory.
     */
    protected loadAdditionalDocuments(_folders: WorkspaceFolder[], _acceptor: (document: LangiumDocument) => void): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Determine the root folder of the source documents in the given workspace folder.
     * The default implementation returns the URI of the workspace folder, but you can override
     * this to return a subfolder like `src` instead.
     */
    protected getRootFolder(folder: WorkspaceFolder): URI {
        return URI.parse(folder.uri);
    }

    /**
     * Traverse the file system folder identified by the given URI and its subFolders. All
     * contained files that match the filter are added to the acceptor.
     */
    protected async traverseFolder(folderPath: URI, fileFilter: (uri: URI) => boolean, acceptor: (document: LangiumDocument) => void): Promise<void> {
        const fsPath = folderPath.fsPath;
        if (!fs.existsSync(fsPath)) {
            console.error(`File ${folderPath} doesn't exist.`);
            return;
        }
        if (this.skipFolder(folderPath)) {
            return;
        }
        const subFolders = await fs.promises.readdir(fsPath, { withFileTypes: true });
        for (const dir of subFolders) {
            const uri = URI.file(path.resolve(fsPath, dir.name));
            if (dir.isDirectory()) {
                await this.traverseFolder(uri, fileFilter, acceptor);
            } else if (fileFilter(uri)) {
                const document = this.langiumDocuments().getOrCreateDocument(uri);
                acceptor(document);
            }
        }
    }

    /**
     * Determine whether the folder with the given path shall be skipped while indexing the workspace.
     */
    protected skipFolder(folderPath: URI): boolean {
        const base = Utils.basename(folderPath);
        return base.startsWith('.') || base === 'node_modules' || base === 'out';
    }

    protected async processDocuments(documents: LangiumDocument[], cancelToken = CancellationToken.None): Promise<void> {
        this.globalScopeCache.clear();
        // first: build exported object data
        for (const document of documents) {
            const services = this.serviceRegistry.getServices(document.uri);
            const indexData: AstNodeDescription[] = await services.index.AstNodeDescriptionProvider.createDescriptions(document, cancelToken);
            for (const data of indexData) {
                data.node = undefined; // clear reference to the AST Node
            }
            this.simpleIndex.set(document.textDocument.uri, indexData);
            await interruptAndCheck(cancelToken);
        }
        // second: create reference descriptions
        for (const document of documents) {
            const services = this.serviceRegistry.getServices(document.uri);
            this.referenceIndex.set(document.textDocument.uri, await services.index.ReferenceDescriptionProvider.createDescriptions(document, cancelToken));
            await interruptAndCheck(cancelToken);
            document.state = DocumentState.Indexed;
        }
    }
}
