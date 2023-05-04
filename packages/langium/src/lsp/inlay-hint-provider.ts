/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { InlayHint, InlayHintParams } from 'vscode-languageserver';
import type { AstNode } from '../syntax-tree';
import { CancellationToken } from 'vscode-languageserver';
import type { MaybePromise } from '../utils/promise-util';
import type { LangiumDocument } from '../workspace/documents';
import { streamAst } from '../utils/ast-util';
import { interruptAndCheck } from '../utils/promise-util';

export type InlayHintAcceptor = (inlayHint: InlayHint) => void;

/**
 * Provider for the inlay hint LSP type.
 */
export interface InlayHintProvider {
    /**
     * Handle the `textDocument.inlayHint` language server request.
     *
     * The inlay hints returned in this method don't need to contain all information about the hint.
     * Instead, the {@link resolveInlayHint} method can be used to provide further information about the hint.
     */
    getInlayHints(document: LangiumDocument, params: InlayHintParams, cancelToken?: CancellationToken): MaybePromise<InlayHint[] | undefined>;
    /**
     * Handle a resolve inlay request. Allows to provide additional information for an inlay hint.
     *
     * This request is performed when a user clicks on a hint provided by the {@link getInlayHints} method.
     * Only needs to be implemented if full inlay link creation is expensive.
     */
    resolveInlayHint?(inlayHint: InlayHint, cancelToken?: CancellationToken): MaybePromise<InlayHint>;
}

export abstract class AbstractInlayHintProvider implements InlayHintProvider {
    async getInlayHints(document: LangiumDocument, params: InlayHintParams, cancelToken = CancellationToken.None): Promise<InlayHint[] | undefined> {
        const root = document.parseResult.value;
        const inlayHints: InlayHint[] = [];
        const acceptor: InlayHintAcceptor = hint => inlayHints.push(hint);
        for (const node of streamAst(root, { range: params.range })) {
            await interruptAndCheck(cancelToken);
            this.computeInlayHint(node, acceptor);
        }
        return inlayHints;
    }

    abstract computeInlayHint(astNode: AstNode, acceptor: InlayHintAcceptor): void;
}
