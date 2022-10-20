/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken } from '@chevrotain/types';
import { Range } from 'vscode-languageserver';
import { CstNode, CompositeCstNode, isCompositeCstNode, isLeafCstNode, LeafCstNode, isRootCstNode } from '../syntax-tree';
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

/**
 * Determines whether the specified cst node is a child of the specified parent node.
 */
export function isCstChildNode(child: CstNode, parent: CstNode): boolean {
    while (child.parent) {
        child = child.parent;
        if (child === parent) {
            return true;
        }
    }
    return false;
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

// The \p{L} regex matches any unicode letter character, i.e. characters from non-english alphabets
// Together with \w it matches any kind of character which can commonly appear in IDs
export const DefaultNameRegexp = /^[\w\p{L}]$/u;

/**
 * Performs `findLeafNodeAtOffset` with a minor difference: When encountering a character that matches the `nameRegexp` argument,
 * it will instead return the leaf node at the `offset - 1` position.
 *
 * For LSP services, users expect that the declaration of an element is available if the cursor is directly after the element.
 */
export function findDeclarationNodeAtOffset(cstNode: CstNode | undefined, offset: number, nameRegexp = DefaultNameRegexp): LeafCstNode | undefined {
    if (cstNode) {
        if (offset > 0) {
            const localOffset = offset - cstNode.offset;
            const textAtOffset = cstNode.text.charAt(localOffset);
            if (!nameRegexp.test(textAtOffset)) {
                offset--;
            }
        }
        return findLeafNodeAtOffset(cstNode, offset);
    }
    return undefined;
}

export function findCommentNode(cstNode: CstNode | undefined, commentNames: string[]): CstNode | undefined {
    if (cstNode) {
        const previous = getPreviousNode(cstNode, true);
        if (previous && isCommentNode(previous, commentNames)) {
            return previous;
        }
        if (isRootCstNode(cstNode)) {
            // Go from the first non-hidden node through all nodes in reverse order
            // We do this to find the comment node which directly precedes the root node
            const endIndex = cstNode.children.findIndex(e => !e.hidden);
            for (let i = endIndex - 1; i >= 0; i--) {
                const child = cstNode.children[i];
                if (isCommentNode(child, commentNames)) {
                    return child;
                }
            }
        }
    }
    return undefined;
}

export function isCommentNode(cstNode: CstNode, commentNames: string[]): boolean {
    return isLeafCstNode(cstNode) && commentNames.includes(cstNode.tokenType.name);
}

export function findLeafNodeAtOffset(node: CstNode, offset: number): LeafCstNode | undefined {
    if (isLeafCstNode(node)) {
        return node;
    } else if (isCompositeCstNode(node)) {
        let firstChild = 0;
        let lastChild = node.children.length - 1;
        while (firstChild <= lastChild) {
            const middleChild = Math.floor((firstChild + lastChild) / 2);
            const n = node.children[middleChild];
            if (n.offset > offset) {
                lastChild = middleChild - 1;
            } else if (n.end <= offset) {
                firstChild = middleChild + 1;
            } else {
                return findLeafNodeAtOffset(n, offset);
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
