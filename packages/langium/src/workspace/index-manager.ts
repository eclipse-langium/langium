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
import type { LangiumDocument } from './documents';
import { CancellationToken } from 'vscode-languageserver';
import { getDocument } from '../utils/ast-util';
import { stream } from '../utils/stream';
import { equalURI } from '../utils/uri-util';

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
     * Determine whether the given document could be affected by changes of the documents
     * identified by the given URIs (second parameter). The document is typically regarded as
     * affected if it contains a reference to any of the changed files.
     *
     * @param document Document to check whether it's affected
     * @param changedUris URIs of the changed documents
     */
    isAffected(document: LangiumDocument, changedUris: Set<string>): boolean;

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
    protected readonly astReflection: AstReflection;

    protected readonly simpleIndex: Map<string, AstNodeDescription[]> = new Map<string, AstNodeDescription[]>();
    protected readonly referenceIndex: Map<string, ReferenceDescription[]> = new Map<string, ReferenceDescription[]>();
    protected readonly globalScopeCache = new Map<string, AstNodeDescription[]>();

    constructor(services: LangiumSharedServices) {
        this.serviceRegistry = services.ServiceRegistry;
        this.astReflection = services.AstReflection;
    }

    findAllReferences(targetNode: AstNode, astNodePath: string): Stream<ReferenceDescription> {
        const targetDocUri = getDocument(targetNode).uri;
        const result: ReferenceDescription[] = [];
        this.referenceIndex.forEach((docRefs: ReferenceDescription[]) => {
            docRefs.forEach((refDescr) => {
                if (equalURI(refDescr.targetUri, targetDocUri) && refDescr.targetPath === astNodePath) {
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
            this.globalScopeCache.clear();
        }
    }

    async updateContent(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<void> {
        this.globalScopeCache.clear();
        const services = this.serviceRegistry.getServices(document.uri);
        const exports: AstNodeDescription[] = await services.references.ScopeComputation.computeExports(document, cancelToken);
        for (const data of exports) {
            data.node = undefined; // clear reference to the AST Node
        }
        this.simpleIndex.set(document.uri.toString(), exports);
    }

    async updateReferences(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<void> {
        const services = this.serviceRegistry.getServices(document.uri);
        const indexData: ReferenceDescription[] = await services.workspace.ReferenceDescriptionProvider.createDescriptions(document, cancelToken);
        this.referenceIndex.set(document.uri.toString(), indexData);
    }

    isAffected(document: LangiumDocument, changedUris: Set<string>): boolean {
        const references = this.referenceIndex.get(document.uri.toString());
        if (!references) {
            return false;
        }
        return references.some(ref => !ref.local && changedUris.has(ref.targetUri.toString()));
    }

}
