/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from '@chevrotain/types';
import { Range } from 'vscode-languageserver';
import { DatatypeSymbol } from '../parser/langium-parser';
import { AstNode, CstNode, isCompositeCstNode, isLeafCstNode, LeafCstNode } from '../syntax-tree';
import { DocumentSegment } from '../workspace/documents';
import { TreeStream, TreeStreamImpl } from './stream';

export function streamCst(node: CstNode): TreeStream<CstNode> {
    return new TreeStreamImpl(node, element => {
        if (isCompositeCstNode(element)) {
            return element.children;
        } else {
            return [];
        }
    });
}

export function flatten(node: CstNode): LeafCstNode[] {
    if (isLeafCstNode(node)) {
        return [node];
    } else if (isCompositeCstNode(node)) {
        return node.children.flatMap(e => flatten(e));
    } else {
        return [];
    }
}

export function tokenToRange(token: IToken): Range {
    // Chevrotain uses 1-based indices everywhere
    // So we subtract 1 from every value to align with the LSP
    return {
        start: {
            character: token.startColumn! - 1,
            line: token.startLine! - 1
        },
        end: {
            character: token.endColumn!, // endColumn uses the correct index
            line: token.endLine! - 1
        }
    };
}

export function toDocumentSegment(node: CstNode): DocumentSegment {
    const { offset, end, range } = node;
    return {
        range,
        offset,
        end,
        length: end - offset
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
    if (cstNode && isCompositeCstNode(cstNode)) {
        for (const node of cstNode.children) {
            if (!node.hidden) {
                break;
            }
            if (isLeafCstNode(node) && commentNames.includes(node.tokenType.name)) {
                lastNode = node;
            }
        }
    }
    return lastNode;
}

export function findLeafNodeAtOffset(node: CstNode, offset: number): LeafCstNode | undefined {
    if (isLeafCstNode(node)) {
        return node;
    } else if (isCompositeCstNode(node)) {
        const children = node.children.filter(e => e.offset <= offset).reverse();
        for (const child of children) {
            const result = findLeafNodeAtOffset(child, offset);
            if (result) {
                return result;
            }
        }
    }
    return undefined;
}
