/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CodeLens, CodeLensParams } from 'vscode-languageserver';
import type { CancellationToken } from '../utils/cancellation.js';
import type { MaybePromise } from '../utils/promise-utils.js';
import type { LangiumDocument } from '../workspace/documents.js';

export interface CodeLensProvider {
    provideCodeLens(document: LangiumDocument, params: CodeLensParams, cancelToken?: CancellationToken): MaybePromise<CodeLens[] | undefined>
}

/**
 * Shared code lens service. Register as `LangiumSharedServices.lsp.CodeLensProvider`.
 * Takes precedence over language-specific providers, even when it returns no lenses.
 */
export interface SharedCodeLensProvider extends CodeLensProvider {
    /**
     * Resolve a lens returned by this provider. Use `CodeLens.data` to preserve its context.
     * Implementations must handle unavailable or invalid source data.
     *
     * Called under an immediate read lock after the configured `CodeLensProvider` phase
     * is reached across the workspace.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error should be sent to the client
     */
    resolveCodeLens?(codeLens: CodeLens, cancelToken?: CancellationToken): MaybePromise<CodeLens>;
}
