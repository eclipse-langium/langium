/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { GrammarConfig } from '../grammar';
import type { LangiumServices } from '../services';
import type { AstNode } from '../syntax-tree';
import { findCommentNode } from '../utils/cst-util';

/**
 * Provides comments for AST nodes.
 */
export interface CommentProvider {
    /**
     * Defines the token types that are considered as comments.
     *
     * The default implementation `DefaultCommentProvider` will return the `multilineCommentRules` from the grammar config.
     */
    getCommentTokenTypes(): string[];

    /**
     * Returns the comment associated with the specified AST node.
     * @param node The AST node to get the comment for.
     * @returns The comment associated with the specified AST node or `undefined` if there is no comment.
     */
    getComment(node: AstNode): string | undefined;
}

export class DefaultCommentProvider implements CommentProvider {
    protected readonly grammarConfig: () => GrammarConfig;
    constructor(services: LangiumServices) {
        this.grammarConfig = () => services.parser.GrammarConfig;
    }
    getCommentTokenTypes(): string[] {
        return this.grammarConfig().multilineCommentRules;
    }
    getComment(node: AstNode): string | undefined {
        return findCommentNode(node.$cstNode, this.getCommentTokenTypes())?.text;
    }
}
