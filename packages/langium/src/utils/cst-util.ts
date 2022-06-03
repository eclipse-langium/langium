/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from '@chevrotain/types';
import { Range } from 'vscode-languageserver';
import { DatatypeSymbol } from '../parser/langium-parser';
import { AstNode, CstNode, CompositeCstNode, isCompositeCstNode, isLeafCstNode, LeafCstNode } from '../syntax-tree';
import { DocumentSegment } from '../workspace/documents';
import { Stream, TreeStream, TreeStreamImpl } from './stream';

/**
 * Create a stream of all CST nodes that are directly and indirectly contained in the given root node,
 * including the root node itself.
 */
export function streamCst(node: CstNode): TreeStream<CstNode> {
    return new TreeStreamImpl(node, element => {
        if (isCompositeCstNode(element)) {
            return element.children;
        } else {
            return [];
        }
    }, { includeRoot: true });
}

/**
 * Create a stream of all leaf nodes that are directly and indirectly contained in the given root node.
 */
export function flattenCst(node: CstNode): Stream<LeafCstNode> {
    return streamCst(node).filter(isLeafCstNode);
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
    if (cstNode) {
        const previous = getPreviousNode(cstNode, true);
        if (previous && isLeafCstNode(previous) && commentNames.includes(previous.tokenType.name)) {
            return previous;
        }
    }
    return undefined;
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

export function getPreviousNode(node: CstNode, hidden = true): CstNode | undefined {
    while (node.parent) {
        const parent = node.parent;
        let index = parent.children.indexOf(node);
        if (index === 0) {
            node = parent;
        } else {
            index--;
            const previous = parent.children[index];
            if (hidden || !previous.hidden) {
                return previous;
            }
        }
    }
    return undefined;
}

export function getNextNode(node: CstNode, hidden = true): CstNode | undefined {
    while (node.parent) {
        const parent = node.parent;
        let index = parent.children.indexOf(node);
        if (parent.children.length - 1 === index) {
            node = parent;
        } else {
            index++;
            const next = parent.children[index];
            if (hidden || !next.hidden) {
                return next;
            }
        }
    }
    return undefined;
}

export function getStartlineNode(node: CstNode): CstNode {
    if (node.range.start.character === 0) {
        return node;
    }
    const line = node.range.start.line;
    let last = node;
    let index: number | undefined;
    while (node.parent) {
        const parent = node.parent;
        const selfIndex = index ?? parent.children.indexOf(node);
        if (selfIndex === 0) {
            node = parent;
            index = undefined;
        } else {
            index = selfIndex - 1;
            node = parent.children[index];
        }
        if (node.range.start.line !== line) {
            break;
        }
        last = node;
    }
    return last;
}

export function getInteriorNodes(start: CstNode, end: CstNode): CstNode[] {
    const commonParent = getCommonParent(start, end);
    if (!commonParent) {
        return [];
    }
    return commonParent.parent.children.slice(commonParent.a + 1, commonParent.b);
}

function getCommonParent(a: CstNode, b: CstNode): CommonParent | undefined {
    const aParents = getParentChain(a);
    const bParents = getParentChain(b);
    let current: CommonParent | undefined;
    for (let i = 0; i < aParents.length && i < bParents.length; i++) {
        const aParent = aParents[i];
        const bParent = bParents[i];
        if (aParent.parent === bParent.parent) {
            current = {
                parent: aParent.parent,
                a: aParent.index,
                b: bParent.index
            };
        } else {
            break;
        }
    }
    return current;
}

interface CommonParent {
    parent: CompositeCstNode
    a: number
    b: number
}

function getParentChain(node: CstNode): ParentLink[] {
    const chain: ParentLink[] = [];
    while (node.parent) {
        const parent = node.parent;
        const index = parent.children.indexOf(node);
        chain.push({
            parent,
            index
        });
        node = parent;
    }
    return chain.reverse();
}

interface ParentLink {
    parent: CompositeCstNode
    index: number
}
