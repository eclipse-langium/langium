/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, CodeLens, CodeLensParams } from 'vscode-languageserver';
import type { MaybePromise } from '../utils/promise-util.js';
import type { LangiumDocument } from '../workspace/documents.js';

export interface CodeLensProvider {
    provideCodeLens(document: LangiumDocument, params: CodeLensParams, cancelToken?: CancellationToken): MaybePromise<CodeLens[] | undefined>
}
