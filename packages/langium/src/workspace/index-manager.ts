/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
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

    async update(documents: LangiumDocument[], cancelToken = CancellationToken.None): Promise<void> {
        this.globalScopeCache.clear();
        // First: build exported object data
        for (const document of documents) {
            const services = this.serviceRegistry.getServices(document.uri);
            const indexData: AstNodeDescription[] = await services.index.AstNodeDescriptionProvider.createDescriptions(document, cancelToken);
            for (const data of indexData) {
                data.node = undefined; // clear reference to the AST Node
            }
            this.simpleIndex.set(document.textDocument.uri, indexData);
            await interruptAndCheck(cancelToken);
        }
        // Second: create reference descriptions
        for (const document of documents) {
            const services = this.serviceRegistry.getServices(document.uri);
            this.referenceIndex.set(document.textDocument.uri, await services.index.ReferenceDescriptionProvider.createDescriptions(document, cancelToken));
            await interruptAndCheck(cancelToken);
            document.state = DocumentState.Indexed;
        }
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

}
