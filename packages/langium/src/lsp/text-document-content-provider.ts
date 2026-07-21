/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, TextDocumentContentParams, TextDocumentContentResult } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import type { LangiumDocuments } from '../workspace/index.js';
import type { LangiumSharedServices } from './lsp-services.js';

/**
 * Shared service for handling the LSP text document content request.
 * It allows clients to request the content of a text document given its URI.
 *
 * This is useful for scenarios where a reference is pointing to a virtual document (such as a builtin library).
 * The client can request the content of that document using this service, without needing to implement a dedicated
 * file system provider on the client side or other means of accessing the document content.
 */
export interface TextDocumentContentProvider {
    /**
     * The URI schemes that this provider supports.
     */
    readonly schemes: string[];
    /**
     * Returns the text content of a file given its URI.
     */
    provideTextDocumentContent(params: TextDocumentContentParams, cancellationToken: CancellationToken): Promise<TextDocumentContentResult | undefined>;
}

/**
 * Default implementation of the `TextDocumentContentProvider` interface.
 * It retrieves the content of a text document from the `LangiumDocuments` service based on the provided URI.
 * If the document is not found or the URI scheme is not supported, it returns `undefined`.
 *
 * This implementation is designed for use cases where the language server already registered virtual documents
 * in the `LangiumDocuments` service - for example, in `loadAdditionalDocuments` of the `DefaultWorkspaceManager`.
 */
export class DefaultTextDocumentContentProvider implements TextDocumentContentProvider {

    private readonly langiumDocuments: LangiumDocuments;

    readonly schemes: string[];

    constructor(services: LangiumSharedServices, schemes: string[]) {
        this.langiumDocuments = services.workspace.LangiumDocuments;
        this.schemes = schemes;
    }

    async provideTextDocumentContent(params: TextDocumentContentParams, _cancellationToken: CancellationToken): Promise<TextDocumentContentResult | undefined> {
        const uri = URI.parse(params.uri);
        if (!this.schemes.includes(uri.scheme)) {
            return undefined;
        }
        const document = this.langiumDocuments.getDocument(uri);
        if (!document) {
            return undefined;
        }
        return { text: document.textDocument.getText() };
    }
}
