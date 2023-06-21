/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from '../syntax-tree';
import { findCommentNode } from '../utils/cst-util';

export interface CommentProvider {
    getCommentTokenTypes(): string[];
    getComment(node: AstNode): string | undefined;
}

export class DefaultCommentProvider implements CommentProvider {
    getCommentTokenTypes(): string[] {
        return ['SL_COMMENT', 'ML_COMMENT'];
    }
    getComment(node: AstNode): string | undefined {
        return findCommentNode(node.$cstNode, this.getCommentTokenTypes())?.text;
    }
}
