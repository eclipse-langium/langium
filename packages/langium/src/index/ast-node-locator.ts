/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode } from '../syntax-tree';

export interface AstNodePathComputer {
    path(node: AstNode): string;
}

export interface AstNodeLocator {
    astNode(path: string): AstNode;
}

export class DefaultAstNodeLocator implements AstNodeLocator, AstNodePathComputer {

    path(node: AstNode): string {
        throw new Error('Method not implemented.');
    }
    astNode(path: string): AstNode {
        throw new Error('Method not implemented.');
    }

}