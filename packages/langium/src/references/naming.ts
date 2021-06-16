/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode } from '../syntax-tree';

export interface NamedAstNode extends AstNode {
    name: string;
}

export function isNamed(node: AstNode): node is NamedAstNode {
    return (node as NamedAstNode).name !== undefined;
}

export interface NameProvider {
    getName(node: AstNode): string | undefined;
}

export class DefaultNameProvider implements NameProvider {
    getName(node: AstNode): string | undefined {
        if (isNamed(node)) {
            return node.name;
        }
        return undefined;
    }
}
