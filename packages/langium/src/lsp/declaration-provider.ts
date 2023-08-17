/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, DeclarationParams, LocationLink } from 'vscode-languageserver';
import type { MaybePromise } from '../utils/promise-util.js';
import type { LangiumDocument } from '../workspace/documents.js';

/**
 * Language-specific service for handling go to declaration requests
 */
export interface DeclarationProvider {
    /**
     * Handle a go to declaration request.
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getDeclaration(document: LangiumDocument, params: DeclarationParams, cancelToken?: CancellationToken): MaybePromise<LocationLink[] | undefined>
}
