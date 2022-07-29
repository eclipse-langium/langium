/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, SignatureHelp, SignatureHelpOptions, SignatureHelpParams } from 'vscode-languageserver';
import { AstNode } from '../syntax-tree';
import { findLeafNodeAtOffset, findRelevantNode } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling signature help requests.
 */
export interface SignatureHelpProvider {
    /**
     * Handles a signature help request
     */
    provideSignatureHelp(document: LangiumDocument, params: SignatureHelpParams, cancelToken?: CancellationToken): MaybePromise<SignatureHelp | undefined>;
    /**
     * Options that determine the server capabilities for a signature help request. It contains the list of triggering characters.
     */
    get signatureHelpOptions(): SignatureHelpOptions;
}

export abstract class AbstractSignatureHelpProvider implements SignatureHelpProvider {
    provideSignatureHelp(document: LangiumDocument, params: SignatureHelpParams): MaybePromise<SignatureHelp | undefined> {
        const rootNode = document.parseResult.value;
        const cst = rootNode.$cstNode;
        if (cst) {
            const sourceCstNode = findLeafNodeAtOffset(cst, document.textDocument.offsetAt(params.position));
            if (sourceCstNode) {
                const element = findRelevantNode(sourceCstNode);
                if (element) {
                    return this.getSignatureFromElement(element);
                }
            }
        }
        return undefined;
    }

    /**
     * Override this method to return the desired SignatureHelp
     */
    protected abstract getSignatureFromElement(element: AstNode): MaybePromise<SignatureHelp | undefined>;

    /**
     * Override this getter to return the list of triggering characters for your language. To deactivate the signature help, return an empty object.
     */
    get signatureHelpOptions(): SignatureHelpOptions {
        return {triggerCharacters: ['('] };
    }
}
