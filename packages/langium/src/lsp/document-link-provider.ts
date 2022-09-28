/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, DocumentLink, DocumentLinkParams } from 'vscode-languageserver';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling document link requests.
 */
export interface DocumentLinkProvider {
    /**
     * Handle a document links request.
     *
     * The document links returned in this method don't need to contain all information necessary to resolve the link.
     * Instead, the {@link resolveDocumentLink} method can be used to provide further information about the link.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getDocumentLinks(document: LangiumDocument, params: DocumentLinkParams, cancelToken?: CancellationToken): MaybePromise<DocumentLink[]>;
    /**
     * Handle a resolve link request. Allows to provide additional information for a document link.
     *
     * This request is performed when a user clicks on a link provided by the {@link getDocumentLinks} method.
     * Only needs to be implemented if full document link creation is expensive.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    resolveDocumentLink?(documentLink: DocumentLink, cancelToken?: CancellationToken): MaybePromise<DocumentLink>;
}
