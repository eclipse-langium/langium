/**********************************************************************************
 * Copyright (c) 2021 TypeFox
 *
 * This program and the accompanying materials are made available under the terms
 * of the MIT License, which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { TokenType } from 'chevrotain';
import { LangiumDocument } from './documents/document';
import { AbstractElement } from './grammar/generated/ast';

export interface AstNode {
    readonly $type: string,
    readonly $container?: AstNode,
    readonly $cstNode?: CstNode,
    readonly $document?: LangiumDocument
}

export type Properties<N extends AstNode> = keyof Omit<N, keyof AstNode>

export interface Reference<T extends AstNode = AstNode> {
    readonly ref?: T;
    readonly $refName: string;
}

export interface AstReflection {
    getAllTypes(): string[]
    getReferenceType(referenceId: string): string
    isInstance(node: AstNode, type: string): boolean
    isSubtype(subtype: string, supertype: string): boolean
}

export interface CstNode {
    readonly parent?: CompositeCstNode;
    readonly offset: number;
    readonly length: number;
    readonly text: string;
    readonly root: CompositeCstNode;
    readonly feature: AbstractElement;
    readonly element: AstNode;
}

export interface CompositeCstNode extends CstNode {
    children: CstNode[];
}

export interface LeafCstNode extends CstNode {
    readonly hidden: boolean;
    readonly tokenType: TokenType;
}
