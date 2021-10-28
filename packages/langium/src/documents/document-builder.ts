/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Connection, Diagnostic } from 'vscode-languageserver';
import { DocumentValidator } from '../validation/document-validator';
import { LangiumParser } from '../parser/langium-parser';
import { ScopeComputation } from '../references/scope';
import { LangiumServices } from '../services';
import { DocumentState, LangiumDocument, LangiumDocuments } from './document';
import { IndexManager } from '../index/index-manager';
import { URI } from 'vscode-uri';
import { interruptAndCheck, MaybePromise } from '../utils/promise-util';
import { Linker } from '../references/linker';
import { AstNode } from '../syntax-tree';

export interface DocumentBuilder {
    /**
     * Inserts the document into the index and rebuilds affected documents
     *
     * @param document which should be built
     * @param cancelToken allows to cancel the current operation
     * @throws `OperationCancelled` if cancellation is detected during execution
     */
    build(document: LangiumDocument, cancelToken?: CancellationToken): Promise<BuildResult>
    /**
     * This method is called when a document change is detected.
     * Implementation should updates the state of that `LangiumDocument` and make sure
     * that the index information of the affected documents are also updated.
     *
     * @param uri of the document that was changed
     * @param cancelToken allows to cancel the current operation
     * @see IndexManager.update()
     * @see LangiumDocuments.invalidateDocument()
     * @throws `OperationCancelled` if cancellation is detected during execution
     */
    documentChanged(uri: URI, cancelToken?: CancellationToken): Promise<void>;
}

export interface BuildResult<T extends AstNode = AstNode> {
    readonly document: LangiumDocument<T>
    readonly diagnostics: Diagnostic[]
}

export class DefaultDocumentBuilder implements DocumentBuilder {
    protected readonly connection?: Connection;
    protected readonly parser: LangiumParser;
    protected readonly scopeComputation: ScopeComputation;
    protected readonly documentValidator: DocumentValidator;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly indexManager: IndexManager;
    protected readonly linker: Linker;

    constructor(services: LangiumServices) {
        this.connection = services.lsp.Connection;
        this.parser = services.parser.LangiumParser;
        this.linker = services.references.Linker;
        this.scopeComputation = services.references.ScopeComputation;
        this.documentValidator = services.validation.DocumentValidator;
        this.langiumDocuments = services.documents.LangiumDocuments;
        this.indexManager = services.index.IndexManager;
    }

    async build(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<BuildResult> {
        await this.buildDocument(document, cancelToken);
        return {
            document,
            diagnostics: await this.validate(document, cancelToken, true)
        };
    }

    protected async validate(document: LangiumDocument, cancelToken = CancellationToken.None, forceDiagnostics = false): Promise<Diagnostic[]> {
        let diagnostics: Diagnostic[] = [];
        const validator = this.documentValidator;
        if (this.connection || forceDiagnostics) {
            diagnostics = await validator.validateDocument(document, cancelToken);
            await interruptAndCheck(cancelToken);
            if (this.connection) {
                // Send the computed diagnostics to VS Code.
                this.connection.sendDiagnostics({ uri: document.textDocument.uri, diagnostics });
            }
            await interruptAndCheck(cancelToken);
            document.state = DocumentState.Validated;
        }
        return diagnostics;
    }

    async documentChanged(uri: URI, cancelToken = CancellationToken.None): Promise<void> {
        this.langiumDocuments.invalidateDocument(uri);
        const newDocument = this.langiumDocuments.getOrCreateDocument(uri);
        await interruptAndCheck(cancelToken);
        await this.buildDocument(newDocument, cancelToken);
    }

    protected async buildDocument(document: LangiumDocument, cancelToken: CancellationToken): Promise<void> {
        const affectedDocuments = this.indexManager.getAffectedDocuments(document).toArray();
        affectedDocuments.forEach(e => {
            this.linker.unlink(e);
            e.state = DocumentState.Indexed;
        });
        const relevantDocuments = Array.from(new Set([
            document,
            ...affectedDocuments,
            // Also include all documents haven't completed the document lifecycle yet
            ...this.langiumDocuments.all.filter(e => e.state < DocumentState.Validated)
        ]));
        await this.runCancelable(relevantDocuments, DocumentState.Indexed, cancelToken, doc => this.indexManager.update(doc, cancelToken));
        await this.runCancelable(relevantDocuments, DocumentState.Processed, cancelToken, doc => this.process(doc, cancelToken));
        await this.runCancelable(relevantDocuments, DocumentState.Linked, cancelToken, doc => this.linker.link(doc, cancelToken));
        await this.runCancelable(relevantDocuments, DocumentState.Validated, cancelToken, doc => this.validate(doc, cancelToken));
    }

    protected async runCancelable(documents: LangiumDocument[], targetState: DocumentState, cancelToken: CancellationToken, callback: (document: LangiumDocument) => MaybePromise<unknown>): Promise<void> {
        for (const document of documents.filter(e => e.state < targetState)) {
            await interruptAndCheck(cancelToken);
            await callback(document);
        }
    }

    /**
     * Process the document by running precomputations. The default implementation precomputes the scope.
     */
    protected async process(document: LangiumDocument, cancelToken: CancellationToken): Promise<void> {
        document.precomputedScopes = await this.scopeComputation.computeScope(document, cancelToken);
        document.state = DocumentState.Processed;
    }
}
