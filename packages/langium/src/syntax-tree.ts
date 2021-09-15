/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

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
    readonly $refNode: CstNode;
    readonly $refName: string;
}

export interface AstReflection {
    getAllTypes(): string[]
    getReferenceType(referenceId: string): string
    isInstance(node: AstNode, type: string): boolean
    isSubtype(subtype: string, supertype: string): boolean
}

export interface CstRange {
    start: number;
    end: number;
}

export interface CstNode {
    readonly parent?: CompositeCstNode;
    readonly offset: number;
    readonly length: number;
    readonly range: CstRange;
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
