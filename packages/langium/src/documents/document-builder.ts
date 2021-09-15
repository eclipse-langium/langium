/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Connection, Diagnostic } from 'vscode-languageserver/node';
import { DocumentValidator } from '../validation/document-validator';
import { LangiumParser, ParseResult } from '../parser/langium-parser';
import { ScopeComputation } from '../references/scope';
import { LangiumServices } from '../services';
import { LangiumDocument, LangiumDocuments } from './document';
import { IndexManager } from '../index/index-manager';

export interface DocumentBuilder {
    build(document: LangiumDocument): BuildResult
    /**
     * Validates a document and creates diagnostic information.
    * @param document to be validated
    * @returns Diagnostic array or undefined if no validation issues found
    */
    validate(document: LangiumDocument): Diagnostic[] | undefined
    /**
     * This method is called when a document change is detected.
     * Implementation should updates the state of that `LangiumDocument` and make sure
     * that the index information of the affected documents are also updated.
     * @param uri of the document that was changed
     * @see IndexManager.update()
     * @see LangiumDocuments.invalidateDocument()
     */
    documentChanged(uri: string): void;
}

export interface BuildResult {
    readonly parseResult: ParseResult
    readonly diagnostics: Diagnostic[]
}

export class DefaultDocumentBuilder implements DocumentBuilder {
    protected readonly connection?: Connection;
    protected readonly parser: LangiumParser;
    protected readonly scopeComputation: ScopeComputation;
    protected readonly documentValidator: DocumentValidator;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly indexManager: IndexManager;

    constructor(services: LangiumServices) {
        this.connection = services.lsp.Connection;
        this.parser = services.parser.LangiumParser;
        this.scopeComputation = services.references.ScopeComputation;
        this.documentValidator = services.validation.DocumentValidator;
        this.langiumDocuments = services.documents.LangiumDocuments;
        this.indexManager = services.index.IndexManager;
    }

    build(document: LangiumDocument): BuildResult {
        const parseResult = this.parser.parse(document);
        document.parseResult = parseResult;
        this.process(document);
        let diagnostics: Diagnostic[] | undefined = this.connection ? this.validate(document) : undefined;
        const validator = this.documentValidator;
        return {
            parseResult: document.parseResult,
            get diagnostics() {
                if (!diagnostics) {
                    diagnostics = validator.validateDocument(document);
                }
                return diagnostics;
            }
        };
    }

    validate(document: LangiumDocument): Diagnostic[] | undefined {
        let diagnostics: Diagnostic[] | undefined;
        const validator = this.documentValidator;
        if (this.connection) {
            diagnostics = validator.validateDocument(document);
            // Send the computed diagnostics to VS Code.
            this.connection.sendDiagnostics({ uri: document.textDocument.uri, diagnostics });
        }
        return diagnostics;
    }

    documentChanged(uri: string): void {
        this.langiumDocuments.invalidateDocument(uri);
        const newDocument = this.langiumDocuments.getOrCreateDocument(uri);
        this.indexManager.update(newDocument);
        this.langiumDocuments.all.filter(doc => this.isAffected(doc, uri)).forEach(
            doc => {
                this.build(doc);
                this.indexManager.update(doc);
            }
        );
        this.build(newDocument);
    }

    /**
     * Process the document by running precomputations. The default implementation precomputes the scope.
     */
    protected process(document: LangiumDocument): void {
        document.precomputedScopes = this.scopeComputation.computeScope(document);
    }

    protected isAffected(document: LangiumDocument, changedUri: string): boolean {
        return changedUri !== document.textDocument.uri;
    }
}