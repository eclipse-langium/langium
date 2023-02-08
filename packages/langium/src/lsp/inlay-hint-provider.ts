/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, InlayHint, InlayHintParams } from 'vscode-languageserver';
import { AstNode } from '../syntax-tree';
import { streamAst } from '../utils/ast-util';
import { interruptAndCheck, MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

export type InlayHintAcceptor = (inlayHint: InlayHint) => void;

export interface InlayHintProvider {
    getInlayHints(document: LangiumDocument, params: InlayHintParams, cancelToken?: CancellationToken): MaybePromise<InlayHint[] | undefined>;
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
