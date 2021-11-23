/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Connection, Diagnostic } from 'vscode-languageserver';
import { LangiumSharedServices } from '../services';
import { DocumentState, LangiumDocument, LangiumDocuments } from './document';
import { IndexManager } from '../index/index-manager';
import { URI } from 'vscode-uri';
import { interruptAndCheck, MaybePromise } from '../utils/promise-util';
import { AstNode } from '../syntax-tree';
import { ServiceRegistry } from '../service-registry';

export interface DocumentBuilder {
    /**
     * Inserts the document into the index and rebuilds affected documents
     *
     * @param document which should be built
     * @param cancelToken allows to cancel the current operation
     * @throws `OperationCancelled` if cancellation is detected during execution
     */
    build<T extends AstNode>(document: LangiumDocument<T>, cancelToken?: CancellationToken): Promise<BuildResult<T>>;

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
    onUpdate(callback: DocumentUpdateListener): void;

    /**
     * Notify the given callback when a set of documents has been built reaching a desired target state.
     */
    onBuildPhase(targetState: DocumentState, callback: DocumentBuildListener): void;
}

export type DocumentUpdateListener = (changed: URI[], deleted: URI[]) => void
export type DocumentBuildListener = (built: LangiumDocument[], cancelToken: CancellationToken) => Promise<void>

export interface BuildResult<T extends AstNode = AstNode> {
    readonly document: LangiumDocument<T>
    readonly diagnostics: Diagnostic[]
}

export class DefaultDocumentBuilder implements DocumentBuilder {
    protected readonly connection?: Connection;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly indexManager: IndexManager;
    protected readonly serviceRegistry: ServiceRegistry;
    protected readonly updateListeners: DocumentUpdateListener[] = [];
    protected readonly buildPhaseListeners: Map<DocumentState, DocumentBuildListener[]> = new Map();

    constructor(services: LangiumSharedServices) {
        this.connection = services.lsp.Connection;
        this.langiumDocuments = services.workspace.LangiumDocuments;
        this.indexManager = services.workspace.IndexManager;
        this.serviceRegistry = services.ServiceRegistry;
    }

    async build<T extends AstNode>(document: LangiumDocument<T>, cancelToken = CancellationToken.None): Promise<BuildResult<T>> {
        await this.buildDocuments([document], cancelToken);
        return {
            document,
            diagnostics: await this.validate(document, cancelToken, true)
        };
    }

    protected async validate(document: LangiumDocument, cancelToken = CancellationToken.None, forceDiagnostics = false): Promise<Diagnostic[]> {
        let diagnostics: Diagnostic[] = [];
        const validator = this.serviceRegistry.getService(document.uri).validation.DocumentValidator;
        if (forceDiagnostics || this.shouldValidate(document)) {
            diagnostics = await validator.validateDocument(document, cancelToken);
            if (this.connection) {
                // Send the computed diagnostics to VS Code.
                this.connection.sendDiagnostics({ uri: document.textDocument.uri, diagnostics });
            }
            document.diagnostics = diagnostics;
            document.state = DocumentState.Validated;
        }
        return diagnostics;
    }

    /**
     * Determine whether the given document should be validated during a build. The default
     * implementation validates whenever a client connection is available.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected shouldValidate(document: LangiumDocument): boolean {
        return this.connection !== undefined;
    }

    async update(changed: URI[], deleted: URI[], cancelToken = CancellationToken.None): Promise<void> {
        for (const deletedDocument of deleted) {
            this.langiumDocuments.invalidateDocument(deletedDocument);
        }
        this.indexManager.remove(deleted);
        for (const changedUri of changed) {
            this.langiumDocuments.invalidateDocument(changedUri);
        }
        for (const listener of this.updateListeners) {
            listener(changed, deleted);
        }
        // Only interrupt execution after everything has been invalidated and update listeners have been notified
        await interruptAndCheck(cancelToken);
        const changedDocuments = changed.map(e => this.langiumDocuments.getOrCreateDocument(e));
        const rebuildDocuments = this.collectDocuments(changedDocuments, deleted);
        await this.buildDocuments(rebuildDocuments, cancelToken);
    }

    onUpdate(callback: DocumentUpdateListener): void {
        this.updateListeners.push(callback);
    }

    protected collectDocuments(changed: LangiumDocument[], deleted: URI[]): LangiumDocument[] {
        const allUris = changed.map(e => e.uri).concat(deleted);
        const affected = this.indexManager.getAffectedDocuments(allUris).toArray();
        affected.forEach(e => {
            const linker = this.serviceRegistry.getService(e.uri).references.Linker;
            linker.unlink(e);
            e.state = DocumentState.Indexed;
        });
        const docSet = new Set([
            ...changed,
            ...affected,
            // Also include all documents haven't completed the document lifecycle yet
            ...this.langiumDocuments.all.filter(e => e.state < DocumentState.Validated)
        ]);
        return Array.from(docSet);
    }

    protected async buildDocuments(documents: LangiumDocument[], cancelToken: CancellationToken): Promise<void> {
        await this.indexManager.update(documents.filter(e => e.state < DocumentState.Indexed), cancelToken);
        await this.notifyBuildPhase(documents, DocumentState.Indexed, cancelToken);
        await this.runCancelable(documents, DocumentState.Processed, cancelToken, doc => this.process(doc, cancelToken));
        await this.runCancelable(documents, DocumentState.Linked, cancelToken, doc => {
            const linker = this.serviceRegistry.getService(doc.uri).references.Linker;
            linker.link(doc, cancelToken);
        });
        await this.runCancelable(documents, DocumentState.Validated, cancelToken, doc => this.validate(doc, cancelToken));
    }

    protected async runCancelable(documents: LangiumDocument[], targetState: DocumentState, cancelToken: CancellationToken, callback: (document: LangiumDocument) => MaybePromise<unknown>): Promise<void> {
        for (const document of documents.filter(e => e.state < targetState)) {
            await interruptAndCheck(cancelToken);
            await callback(document);
        }
        await this.notifyBuildPhase(documents, targetState, cancelToken);
    }

    onBuildPhase(targetState: DocumentState, callback: DocumentBuildListener): void {
        if (this.buildPhaseListeners.has(targetState)) {
            this.buildPhaseListeners.get(targetState)!.push(callback);
        } else {
            this.buildPhaseListeners.set(targetState, [callback]);
        }
    }

    protected async notifyBuildPhase(documents: LangiumDocument[], state: DocumentState, cancelToken: CancellationToken): Promise<void> {
        const listeners = this.buildPhaseListeners.get(state);
        if (listeners) {
            for (const listener of listeners) {
                await interruptAndCheck(cancelToken);
                await listener(documents, cancelToken);
            }
        }
    }

    /**
     * Process the document by running precomputations. The default implementation precomputes the scope.
     */
    protected async process(document: LangiumDocument, cancelToken: CancellationToken): Promise<void> {
        const scopeComputation = this.serviceRegistry.getService(document.uri).references.ScopeComputation;
        document.precomputedScopes = await scopeComputation.computeScope(document, cancelToken);
        document.state = DocumentState.Processed;
    }
}
