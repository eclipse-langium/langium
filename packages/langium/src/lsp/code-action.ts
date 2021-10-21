/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CodeAction, CodeActionParams, Command,  } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { Response } from './lsp-util';

export interface CodeActionProvider {
    getCodeActions(document: LangiumDocument, params: CodeActionParams, cancelToken?: CancellationToken): Response<Array<Command | CodeAction> | undefined>;
}
