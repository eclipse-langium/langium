/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Range } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { AstNode, CstNode, LeafCstNode } from '../syntax-tree';
import { CompositeCstNodeImpl, LeafCstNodeImpl } from '../parser/cst-node-builder';
import { DatatypeSymbol } from '../parser/langium-parser';
import { TreeStream, TreeStreamImpl } from './stream';

export function streamCst(node: CstNode): TreeStream<CstNode> {
    return new TreeStreamImpl(node, element => {
        if (element instanceof CompositeCstNodeImpl) {
            return element.children;
        } else {
            return [];
        }
    });
}

export function flatten(node: CstNode): LeafCstNode[] {
    if (node instanceof LeafCstNodeImpl) {
        return [node];
    } else if (node instanceof CompositeCstNodeImpl) {
        return node.children.flatMap(e => flatten(e));
    } else {
        return [];
    }
}

export function toRange(node: CstNode, document: LangiumDocument): Range {
    const { start, end } = node.range;
    return {
        start: document.textDocument.positionAt(start),
        end: document.textDocument.positionAt(end)
    };
}

export function findRelevantNode(cstNode: CstNode): AstNode | undefined {
    let n: CstNode | undefined = cstNode;
    do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = n.element as any;
        if (element.$type !== DatatypeSymbol) {
            return element;
        }
        n = n.parent;
    } while (n);
    return undefined;
}

export function findCommentNode(cstNode: CstNode | undefined, commentNames: string[]): CstNode | undefined {
    let lastNode: CstNode | undefined;
    if (cstNode instanceof CompositeCstNodeImpl) {
        for (const node of cstNode.children) {
            if (!node.hidden) {
                break;
            }
            if (node instanceof LeafCstNodeImpl && commentNames.includes(node.tokenType.name)) {
                lastNode = node;
            }
        }
    }
    return lastNode;
}