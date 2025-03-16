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
     * Returns the comments associated with the specified offset.
     * @param offset The source offset get the comment for.
     * @returns The comments associated with the specified offset or `undefined` if there is no comment.
     */
    getComments(offset?: number): ReadonlyArray<string> | undefined;

    /**
     * Registers the comments of a token.
     * @param token The token
     * @param hidden The hidden tokens
     */
    registerComments(token: IToken, hidden: Array<IToken>): void;
}

export class DefaultCommentProvider implements CommentProvider {
    protected readonly grammarConfig: () => GrammarConfig;
    protected readonly commentsByOffset: Map<number, Array<string>> = new Map();
    constructor(services: LangiumCoreServices) {
        this.grammarConfig = () => services.parser.GrammarConfig;
    }
    getComment(node: AstNode): string | undefined {
        if(isAstNodeWithComment(node)) {
            return node.$comment;
        }
        return this.getComments(node.$cstNode?.offset)?.at(-1);
    }
    getComments(offset: number = -1): ReadonlyArray<string> | undefined {
        return this.commentsByOffset.get(offset);
    }
    registerComments(token: IToken, hidden: Array<IToken>) {
        const { multilineCommentRules } = this.grammarConfig();
        const comments = hidden.filter((hiddenToken) =>
            multilineCommentRules.includes(hiddenToken.tokenType.name)
        ).map((commentToken) => commentToken.image);
        if (comments.length) {
            this.commentsByOffset.set(token.startOffset, comments);
        }
    }
}
