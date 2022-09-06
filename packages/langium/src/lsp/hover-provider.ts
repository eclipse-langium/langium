/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, Hover, HoverParams } from 'vscode-languageserver';
import { GrammarConfig } from '../grammar/grammar-config';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { findCommentNode, findDeclarationNodeAtOffset } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';

/**
 * Language-specific service for handling hover requests.
 */
export interface HoverProvider {
    /**
     * Handle a hover request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getHoverContent(document: LangiumDocument, params: HoverParams, cancelToken?: CancellationToken): MaybePromise<Hover | undefined>;
}

export abstract class AstNodeHoverProvider implements HoverProvider {

    protected readonly references: References;
    protected readonly grammarConfig: GrammarConfig;

    constructor(services: LangiumServices) {
        this.references = services.references.References;
        this.grammarConfig = services.parser.GrammarConfig;
    }

    getHoverContent(document: LangiumDocument, params: HoverParams): MaybePromise<Hover | undefined> {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (rootNode) {
            const offset = document.textDocument.offsetAt(params.position);
            const cstNode = findDeclarationNodeAtOffset(rootNode, offset, this.grammarConfig.nameRegexp);
            if (cstNode && cstNode.offset + cstNode.length > offset) {
                const targetNode = this.references.findDeclaration(cstNode);
                if (targetNode) {
                    return this.getAstNodeHoverContent(targetNode);
                }
            }
        }
        return undefined;
    }

    protected abstract getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined>;

}

export class MultilineCommentHoverProvider extends AstNodeHoverProvider {

    protected readonly commentContentRegex = /\/\*([\s\S]*?)\*\//;

    protected getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
        const lastNode = findCommentNode(node.$cstNode, this.grammarConfig.multilineCommentRules);
        let content: string | undefined;
        if (lastNode) {
            const exec = this.commentContentRegex.exec(lastNode.text);
            if (exec && exec[1]) {
                content = this.getCommentContent(exec[1]);
            }
        }
        if (content) {
            return {
                contents: {
                    kind: 'markdown',
                    value: content
                }
            };
        }
        return undefined;
    }

    protected getCommentContent(commentText: string): string {
        const split = commentText.split('\n').map(e => {
            e = e.trim();
            if (e.startsWith('*')) {
                e = e.substring(1).trim();
            }
            return e;
        });
        return split.join(' ').trim();
    }

}
