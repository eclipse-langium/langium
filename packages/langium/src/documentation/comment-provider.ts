/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from 'chevrotain';
import type { GrammarConfig } from '../languages/grammar-config.js';
import { isAstNodeWithComment } from '../serializer/json-serializer.js';
import type { LangiumCoreServices } from '../services.js';
import type { AstNode } from '../syntax-tree.js';

/**
 * Provides comments for AST nodes.
 */
export interface CommentProvider {
    /**
     * Returns the comment associated with the specified AST node.
     * @param node The AST node to get the comment for.
     * @returns The comment associated with the specified AST node or `undefined` if there is no comment.
     */
    getComment(node: AstNode): string | undefined;

    /**
     * Registers the documentation comment of a token.
     * @param token The token
     */
    registerComment(token: IToken): void;
}

export class DefaultCommentProvider implements CommentProvider {
    protected readonly grammarConfig: () => GrammarConfig;
    protected readonly offsetToComment: Map<number, string> = new Map();
    constructor(services: LangiumCoreServices) {
        this.grammarConfig = () => services.parser.GrammarConfig;
    }
    getComment(node: AstNode): string | undefined {
        if(isAstNodeWithComment(node)) {
            return node.$comment;
        }
        return this.offsetToComment.get(node.$cstNode?.offset ?? -1);
    }
    registerComment(token: IToken) {
        const [hiddenTokens] = <[Array<IToken>, boolean]>token.payload;
        const hiddenToken = hiddenTokens.findLast((hiddenToken) =>
            this.grammarConfig().multilineCommentRules.includes(hiddenToken.tokenType.name)
        );
        if (hiddenToken) {
            this.offsetToComment.set(token.startOffset, hiddenToken.image);
        }
    }
}
