/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { GrammarConfig } from '../grammar';
import type { AstNodeWithComment } from '../serializer';
import type { LangiumServices } from '../services';
import type { AstNode } from '../syntax-tree';
import { findCommentNode } from '../utils/cst-util';

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
}

export class DefaultCommentProvider implements CommentProvider {
    protected readonly grammarConfig: () => GrammarConfig;
    constructor(services: LangiumServices) {
        this.grammarConfig = () => services.parser.GrammarConfig;
    }
    getComment(node: AstNode): string | undefined {
        if('$comment' in node) {
            return (node as AstNodeWithComment).$comment;
        }
        return findCommentNode(node.$cstNode, this.grammarConfig().multilineCommentRules)?.text;
    }
}
