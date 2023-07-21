/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { URI } from 'vscode-uri';
import type { ServiceRegistry } from '../service-registry';
import type { LangiumSharedServices } from '../services';
import type { AstNode, AstNodeDescription, AstReflection } from '../syntax-tree';
import type { Stream } from '../utils/stream';
import type { ReferenceDescription } from './ast-descriptions';
import type { LangiumDocument, LangiumDocuments } from './documents';
import { CancellationToken } from 'vscode-languageserver';
import { getDocument } from '../utils/ast-util';
import { stream } from '../utils/stream';
import { equalURI } from '../utils/uri-util';
import { DocumentState } from './documents';
import { ContextCache } from '../utils/caching';

/**
 * The index manager is responsible for keeping metadata about symbols and cross-references
 * in the workspace. It is used to look up symbols in the global scope, mostly during linking
 * and completion. This service is shared between all languages of a language server.
 */
export interface IndexManager {

    /**
     * Deletes the specified document uris from the index.
     * Necessary when documents are deleted and not referenceable anymore.
     *
     * @param uris The document uris to delete.
     */
    remove(uris: URI[]): void;

    /**
     * Updates the information about the exportable content of a document inside the index.
     *
     * @param document Document to be updated
     * @param cancelToken Indicates when to cancel the current operation.
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    updateContent(document: LangiumDocument, cancelToken?: CancellationToken): Promise<void>;

    /**
     * Updates the information about the cross-references of a document inside the index.
     *
     * @param document Document to be updated
     * @param cancelToken Indicates when to cancel the current operation.
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    updateReferences(document: LangiumDocument, cancelToken?: CancellationToken): Promise<void>;

    /**
     * Returns all documents that could be affected by changes in the documents
     * identified by the given URIs.
     *
     * @param uris The document URIs which may affect other documents.
     */
    getAffectedDocuments(uris: URI[]): Stream<LangiumDocument>;

    /**
     * Compute a list of all exported elements, optionally filtered using a type identifier and document URIs.
     *
     * @param nodeType The type to filter with, or `undefined` to return descriptions of all types.
     * @param uris If specified, only returns elements from the given URIs.
     * @returns a `Stream` containing all globally visible nodes (of a given type).
     */
    allElements(nodeType?: string, uris?: Set<string>): Stream<AstNodeDescription>;

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
    protected readonly documents: LangiumDocuments;
    protected readonly astReflection: AstReflection;

    /**
     * The `simpleIndex` stores all `AstNodeDescription` items exported by a document.
     * The key used in this map is the string representation of the specific document URI.
     */
    protected readonly simpleIndex = new Map<string, AstNodeDescription[]>();
    /**
     * This is a cache for the `allElements()` method.
     * It caches the descriptions from `simpleIndex` grouped by types.
     */
    protected readonly simpleTypeIndex = new ContextCache<string, string, AstNodeDescription[]>();
    /**
     * This index keeps track of all `ReferenceDescription` items exported by a document.
     * This is used to compute which elements are affected by a document change
     * and for finding references to an AST node.
     */
    protected readonly referenceIndex = new Map<string, ReferenceDescription[]>();

    constructor(services: LangiumSharedServices) {
        this.documents = services.workspace.LangiumDocuments;
        this.serviceRegistry = services.ServiceRegistry;
        this.astReflection = services.AstReflection;
    }

    findAllReferences(targetNode: AstNode, astNodePath: string): Stream<ReferenceDescription> {
        const targetDocUri = getDocument(targetNode).uri;
        const result: ReferenceDescription[] = [];
        this.referenceIndex.forEach(docRefs => {
            docRefs.forEach(refDescr => {
                if (equalURI(refDescr.targetUri, targetDocUri) && refDescr.targetPath === astNodePath) {
                    result.push(refDescr);
                }
            });
        });
        return stream(result);
    }

    allElements(nodeType?: string, uris?: Set<string>): Stream<AstNodeDescription> {
        let documentUris = stream(this.simpleIndex.keys());
        if (uris) {
            documentUris = documentUris.filter(uri => !uris || uris.has(uri));
        }
        return documentUris
            .map(uri => this.getFileDescriptions(uri, nodeType))
            .flat();
    }

    protected getFileDescriptions(uri: string, nodeType?: string): AstNodeDescription[] {
        if (!nodeType) {
            return this.simpleIndex.get(uri) ?? [];
        }
        const descriptions = this.simpleTypeIndex.get(uri, nodeType, () => {
            const allFileDescriptions = this.simpleIndex.get(uri) ?? [];
            return allFileDescriptions.filter(e => this.astReflection.isSubtype(e.type, nodeType));
        });
        return descriptions;
    }

    remove(uris: URI[]): void {
        for (const uri of uris) {
            const uriString = uri.toString();
            this.simpleIndex.delete(uriString);
            this.simpleTypeIndex.clear(uriString);
            this.referenceIndex.delete(uriString);
        }
    }

    async updateContent(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<void> {
        const services = this.serviceRegistry.getServices(document.uri);
        const exports: AstNodeDescription[] = await services.references.ScopeComputation.computeExports(document, cancelToken);
        for (const data of exports) {
            data.node = undefined; // clear reference to the AST Node
        }
        const uri = document.uri.toString();
        this.simpleIndex.set(uri, exports);
        this.simpleTypeIndex.clear(uri);
        document.state = DocumentState.IndexedContent;
    }

    async updateReferences(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<void> {
        const services = this.serviceRegistry.getServices(document.uri);
        const indexData: ReferenceDescription[] = await services.workspace.ReferenceDescriptionProvider.createDescriptions(document, cancelToken);
        this.referenceIndex.set(document.uri.toString(), indexData);
        document.state = DocumentState.IndexedReferences;
    }

    getAffectedDocuments(uris: URI[]): Stream<LangiumDocument> {
        return this.documents.all.filter(e => {
            if (uris.some(uri => equalURI(e.uri, uri))) {
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
        // Cache the uri string
        const changedUriString = changed.toString();
        const documentUri = document.uri.toString();
        // The document is affected if it contains linking errors
        if (document.references.some(e => e.error !== undefined)) {
            return true;
        }
        const references = this.referenceIndex.get(documentUri);
        // ...or if it contains a reference to the changed file
        if (references) {
            return references.filter(e => !e.local).some(e => equalURI(e.targetUri, changedUriString));
        }
        return false;
    }

}
