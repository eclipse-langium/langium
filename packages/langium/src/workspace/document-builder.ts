/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { URI } from 'vscode-uri';
import type { ServiceRegistry } from '../service-registry';
import type { LangiumSharedServices } from '../services';
import type { AstNode } from '../syntax-tree';
import type { MaybePromise } from '../utils/promise-util';
import type { IndexManager } from '../workspace/index-manager';
import type { LangiumDocument, LangiumDocuments, LangiumDocumentFactory } from './documents';
import { CancellationToken, Disposable } from 'vscode-languageserver';
import { MultiMap } from '../utils/collections';
import { interruptAndCheck } from '../utils/promise-util';
import { stream } from '../utils/stream';
import { DocumentState } from './documents';

export interface BuildOptions {
    validationChecks?: 'none' | 'all'
}

/**
 * Shared-service for building and updating `LangiumDocument`s.
 */
export interface DocumentBuilder {
    /**
     * Execute all necessary build steps for the given documents.
     *
     * @param documents Set of documents to be built.
     * @param options Options for the document builder.
     * @param cancelToken Indicates when to cancel the current operation.
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    build<T extends AstNode>(documents: Array<LangiumDocument<T>>, options?: BuildOptions, cancelToken?: CancellationToken): Promise<void>;

    /**
     * This method is called when a document change is detected.
     * Implementation should update the state of associated `LangiumDocument` instances and make sure
     * that the index information of the affected documents are also updated.
     *
     * @param changed URIs of changed/created documents
     * @param deleted URIs of deleted documents
     * @param cancelToken allows to cancel the current operation
     * @see IndexManager.update()
     * @see LangiumDocuments.invalidateDocument()
     * @throws `OperationCancelled` if cancellation is detected during execution
     */
    update(changed: URI[], deleted: URI[], cancelToken?: CancellationToken): Promise<void>;

    /**
     * Notify the given callback when a document update was triggered, but before any document
     * is rebuilt. Listeners to this event should not perform any long-running task.
     */
    onUpdate(callback: DocumentUpdateListener): Disposable;

    /**
     * Notify the given callback when a set of documents has been built reaching a desired target state.
     */
    onBuildPhase(targetState: DocumentState, callback: DocumentBuildListener): Disposable;
}

export type DocumentUpdateListener = (changed: URI[], deleted: URI[]) => void
export type DocumentBuildListener = (built: LangiumDocument[], cancelToken: CancellationToken) => void | Promise<void>
export class DefaultDocumentBuilder implements DocumentBuilder {
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly langiumDocumentFactory: LangiumDocumentFactory;
    protected readonly indexManager: IndexManager;
    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly updateListeners: DocumentUpdateListener[] = [];
    protected readonly buildPhaseListeners: MultiMap<DocumentState, DocumentBuildListener> = new MultiMap();

    constructor(services: LangiumSharedServices) {
        this.langiumDocuments = services.workspace.LangiumDocuments;
        this.langiumDocumentFactory = services.workspace.LangiumDocumentFactory;
        this.indexManager = services.workspace.IndexManager;
        this.serviceRegistry = services.ServiceRegistry;
    }

    async build<T extends AstNode>(documents: Array<LangiumDocument<T>>, options: BuildOptions = {}, cancelToken = CancellationToken.None): Promise<void> {
        await this.buildDocuments(documents, options, cancelToken);
    }

    async update(changed: URI[], deleted: URI[], cancelToken = CancellationToken.None): Promise<void> {
        // Remove all documents that are reported as deleted
        for (const deletedDocument of deleted) {
            this.langiumDocuments.deleteDocument(deletedDocument);
        }
        this.indexManager.remove(deleted);
        // Set the state of all changed documents to `Changed` so they are completely rebuilt
        for (const changedUri of changed) {
            const invalidated = this.langiumDocuments.invalidateDocument(changedUri);
            if (!invalidated) {
                this.langiumDocuments.getOrCreateDocument(changedUri);
            }
        }
        // Set the state of all documents that should be relinked to `ComputedScopes` (if not already lower)
        const allChangedUris = stream(changed).concat(deleted).map(uri => uri.toString()).toSet();
        this.langiumDocuments.all
            .filter(doc => !allChangedUris.has(doc.uri.toString()) && this.shouldRelink(doc, allChangedUris))
            .forEach(doc => {
                const linker = this.serviceRegistry.getServices(doc.uri).references.Linker;
                linker.unlink(doc);
                doc.state = Math.min(doc.state, DocumentState.ComputedScopes);
            });
        // Notify listeners of the update
        for (const listener of this.updateListeners) {
            listener(changed, deleted);
        }
        // Only allow interrupting the execution after all state changes are done
        await interruptAndCheck(cancelToken);

        // Collect all documents that we should rebuild
        const rebuildDocuments = this.langiumDocuments.all
            .filter(doc =>
                // This includes those that were reported as changed and those that we selected for relinking
                doc.state < DocumentState.Linked
                // This includes those for which a previous build has been cancelled
                || doc.build !== undefined
            )
            .toArray();
        const buildOptions: BuildOptions = {
            // This method is meant to be called after receiving a change notification from the client,
            // so we assume that we want diagnostics to be reported in the editor.
            validationChecks: 'all'
        };
        await this.buildDocuments(rebuildDocuments, buildOptions, cancelToken);
    }

    /**
     * Check whether the given document should be relinked after changes were found in the given URIs.
     */
    protected shouldRelink(document: LangiumDocument, changedUris: Set<string>): boolean {
        // Relink documents with linking errors -- maybe those references can be resolved now
        if (document.references.some(ref => ref.error !== undefined)) {
            return true;
        }
        // Check whether the document is affected by any of the changed URIs
        return this.indexManager.isAffected(document, changedUris);
    }

    onUpdate(callback: DocumentUpdateListener): Disposable {
        this.updateListeners.push(callback);
        return Disposable.create(() => {
            const index = this.updateListeners.indexOf(callback);
            if (index >= 0) {
                this.updateListeners.splice(index, 1);
            }
        });
    }

    /**
     * Build the given documents by stepping through all build phases. If a document's state indicates
     * that a certain build phase is already done, the phase is skipped for that document.
     */
    protected async buildDocuments(documents: LangiumDocument[], options: BuildOptions, cancelToken: CancellationToken): Promise<void> {
        for (const doc of documents) {
            doc.build ??= { options };
        }

        // 0. Parse content
        await this.runCancelable(documents, DocumentState.Parsed, cancelToken, doc =>
            this.langiumDocumentFactory.update(doc)
        );
        // 1. Index content
        await this.runCancelable(documents, DocumentState.IndexedContent, cancelToken, doc =>
            this.indexManager.updateContent(doc, cancelToken)
        );
        // 2. Compute scopes
        await this.runCancelable(documents, DocumentState.ComputedScopes, cancelToken, doc =>
            this.computeScopes(doc, cancelToken)
        );
        // 3. Linking
        await this.runCancelable(documents, DocumentState.Linked, cancelToken, doc =>
            this.serviceRegistry.getServices(doc.uri).references.Linker.link(doc, cancelToken)
        );
        // 4. Index references
        await this.runCancelable(documents, DocumentState.IndexedReferences, cancelToken, doc =>
            this.indexManager.updateReferences(doc, cancelToken)
        );
        // 5. Validation
        const validateDocs = documents.filter(doc => this.shouldValidate(doc));
        await this.runCancelable(validateDocs, DocumentState.Validated, cancelToken, doc =>
            this.validate(doc, cancelToken)
        );

        // If we've made it to this point without being cancelled, we can mark the build status
        // as finished by deleting the `build` property.
        for (const doc of documents) {
            delete doc.build;
        }
    }

    protected async runCancelable(documents: LangiumDocument[], targetState: DocumentState, cancelToken: CancellationToken, callback: (document: LangiumDocument) => MaybePromise<unknown>): Promise<void> {
        const filtered = documents.filter(e => e.state < targetState);
        for (const document of filtered) {
            await interruptAndCheck(cancelToken);
            await callback(document);
        }
        await this.notifyBuildPhase(filtered, targetState, cancelToken);
    }

    onBuildPhase(targetState: DocumentState, callback: DocumentBuildListener): Disposable {
        this.buildPhaseListeners.add(targetState, callback);
        return Disposable.create(() => {
            this.buildPhaseListeners.delete(targetState, callback);
        });
    }

    protected async notifyBuildPhase(documents: LangiumDocument[], state: DocumentState, cancelToken: CancellationToken): Promise<void> {
        if (documents.length === 0) {
            // Don't notify when no document has been processed
            return;
        }
        const listeners = this.buildPhaseListeners.get(state);
        for (const listener of listeners) {
            await interruptAndCheck(cancelToken);
            await listener(documents, cancelToken);
        }
    }

    /**
     * Precompute the local scopes of the given document. The resulting data structure is used by
     * the `ScopeProvider` service to determine the visible scope of any cross-reference.
     *
     * _Note:_ You should not resolve any cross-references during this phase. Once the phase is completed,
     * you may follow the `ref` property of a reference, which triggers lazy resolution. The result is
     * either the respective target AST node or `undefined` in case the target is not in scope.
     */
    protected async computeScopes(document: LangiumDocument, cancelToken: CancellationToken): Promise<void> {
        const scopeComputation = this.serviceRegistry.getServices(document.uri).references.ScopeComputation;
        document.precomputedScopes = await scopeComputation.computeLocalScopes(document, cancelToken);
        document.state = DocumentState.ComputedScopes;
    }

    /**
     * Determine whether the given document should be validated during a build. The default
     * implementation checks the `validationChecks` property of the build options.
     */
    protected shouldValidate(document: LangiumDocument): boolean {
        return document.build?.options.validationChecks === 'all';
    }

    /**
     * Run validation checks on the given document and store the resulting diagnostics in the document.
     */
    protected async validate(document: LangiumDocument, cancelToken: CancellationToken): Promise<void> {
        const validator = this.serviceRegistry.getServices(document.uri).validation.DocumentValidator;
        const diagnostics = await validator.validateDocument(document, cancelToken);
        document.diagnostics = diagnostics;
        document.state = DocumentState.Validated;
    }

}
