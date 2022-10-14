/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CodeLens, CodeLensParams } from 'vscode-languageserver';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

export interface CodeLensProvider {
    provideCodeLens(document: LangiumDocument, params: CodeLensParams, cancelToken?: CancellationToken): MaybePromise<CodeLens[] | undefined>
    resolveCodeLens?(params: CodeLens, cancelToken?: CancellationToken): MaybePromise<CodeLens>
}
