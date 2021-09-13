/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, CstNode, LeafCstNode, Reference } from '../syntax-tree';
import { Stream, StreamImpl, DONE_RESULT, TreeStream, TreeStreamImpl, stream } from '../utils/stream';
import { LangiumDocument } from '../documents/document';
import { CompositeCstNodeImpl, LeafCstNodeImpl } from '../parser/cst-node-builder';

export type Mutable<T> = {
    -readonly [P in keyof T]: T[P]
};

export function isAstNode(obj: unknown): obj is AstNode {
    return typeof obj === 'object' && obj !== null && typeof (obj as AstNode).$type === 'string';
}

export function isReference(obj: unknown): obj is Reference {
    return typeof obj === 'object' && obj !== null && typeof (obj as Reference).$refName === 'string';
}

export function getContainerOfType<T extends AstNode>(node: AstNode | undefined, typePredicate: (n: AstNode) => n is T): T | undefined {
    let item = node;
    while (item) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (typePredicate(item)) {
            return item;
        }
        item = item.$container;
    }
    return undefined;
}

export function getDocument(node: AstNode): LangiumDocument {
    let n = node;
    while (!n.$document && n.$container) {
        n = n.$container;
    }
    if (!n.$document) {
        throw new Error('AST node has no document.');
    }
    return n.$document;
}

export interface AstNodeContent {
    node: AstNode
    property: string
    index?: number
}

export function streamContents(node: AstNode): Stream<AstNodeContent> {
    type State = { keys: string[], keyIndex: number, arrayIndex: number };
    return new StreamImpl<State, AstNodeContent>(() => ({
        keys: Object.keys(node),
        keyIndex: 0,
        arrayIndex: 0
    }), state => {
        while (state.keyIndex < state.keys.length) {
            const property = state.keys[state.keyIndex];
            if (!property.startsWith('$')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (node as any)[property];
                if (isAstNode(value)) {
                    state.keyIndex++;
                    return { done: false, value: { node: value, property } };
                } else if (Array.isArray(value)) {
                    while (state.arrayIndex < value.length) {
                        const index = state.arrayIndex++;
                        const element = value[index];
                        if (isAstNode(element)) {
                            return { done: false, value: { node: element, property, index } };
                        }
                    }
                    state.arrayIndex = 0;
                }
            }
            state.keyIndex++;
        }
        return DONE_RESULT;
    });
}

export function streamAllContents(node: AstNode): TreeStream<AstNodeContent> {
    const root = { node } as AstNodeContent;
    return new TreeStreamImpl(root, content => streamContents(content.node));
}

export interface AstNodeReference {
    reference: Reference
    container: AstNode
    property: string
    index?: number
}

export function streamReferences(node: AstNode): Stream<AstNodeReference> {
    type State = { keys: string[], keyIndex: number, arrayIndex: number };
    return new StreamImpl<State, AstNodeReference>(() => ({
        keys: Object.keys(node),
        keyIndex: 0,
        arrayIndex: 0
    }), state => {
        while (state.keyIndex < state.keys.length) {
            const property = state.keys[state.keyIndex];
            if (!property.startsWith('$')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (node as any)[property];
                if (isReference(value)) {
                    state.keyIndex++;
                    return { done: false, value: { reference: value, container: node, property } };
                } else if (Array.isArray(value)) {
                    while (state.arrayIndex < value.length) {
                        const index = state.arrayIndex++;
                        const element = value[index];
                        if (isReference(element)) {
                            return { done: false, value: { reference: element, container: node, property, index } };
                        }
                    }
                    state.arrayIndex = 0;
                }
            }
            state.keyIndex++;
        }
        return DONE_RESULT;
    });
}

export function resolveAllReferences(node: AstNode): { unresolved: AstNodeReference[] } {
    const result: { unresolved: AstNodeReference[] } = {
        unresolved: []
    };
    const process = (n: AstNodeContent) => {
        streamReferences(n.node).forEach(r => {
            const value = r.reference.ref; // Ref get links to a AstNode
            if (value === undefined) {
                result.unresolved.push(r);
            }
        });
    };
    process({ node } as AstNodeContent);
    streamAllContents(node).forEach(process);
    return result;
}

export function findLeafNodeAtOffset(node: CstNode, offset: number): LeafCstNode | undefined {
    if (node instanceof LeafCstNodeImpl) {
        return node;
    } else if (node instanceof CompositeCstNodeImpl) {
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

/**
 * Returns a Stream of references to targetNode from the AstNode tree
 *
 * @param targetNode AstNode we are looking for
 * @param lookup AstNode where we are looking for references. This node
 *      can be RootAstNode but must not. It also must not be from the same
 *      Document as the targetNode.
 */
export function findLocalReferences(targetNode: AstNode, lookup: AstNode): Stream<Reference> {
    const refs: Reference[] = [];
    const process = (node: AstNodeContent) => {
        streamReferences(node.node).forEach((refNode: AstNodeReference) => {
            if (refNode.reference.ref === targetNode) {
                refs.push(refNode.reference);
            }
        });
    };
    streamAllContents(lookup).forEach(process);
    return stream(refs);
}
