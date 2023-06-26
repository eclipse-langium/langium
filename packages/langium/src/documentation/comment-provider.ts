/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { GrammarConfig } from '../grammar';
import type { LangiumServices } from '../services';
import type { AstNode } from '../syntax-tree';
import { findCommentNode } from '../utils/cst-util';

export interface CommentProvider {
    getCommentTokenTypes(): string[];
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
