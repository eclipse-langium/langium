/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CodeAction, CodeActionClientCapabilities, CodeActionParams, Command } from 'vscode-languageserver';
import { InitializableService } from '../services';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

export interface CodeActionProvider extends InitializableService<CodeActionClientCapabilities> {
    /**
     * Handle a code action request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getCodeActions(document: LangiumDocument, params: CodeActionParams, cancelToken?: CancellationToken): MaybePromise<Array<Command | CodeAction> | undefined>;
}
