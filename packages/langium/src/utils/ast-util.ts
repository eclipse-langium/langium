/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AstNodeDescription, CstNode, LeafCstNode, LinkingError, Reference, ReferenceInfo } from '../syntax-tree';
import { Stream, StreamImpl, DONE_RESULT, TreeStream, TreeStreamImpl, stream } from '../utils/stream';
import { LangiumDocument } from '../documents/document';
import { CompositeCstNodeImpl, LeafCstNodeImpl } from '../parser/cst-node-builder';
import { CancellationToken } from 'vscode-languageserver';
import { interruptAndCheck } from './promise-util';

export type Mutable<T> = {
    -readonly [P in keyof T]: T[P]
};

export function isAstNode(obj: unknown): obj is AstNode {
    return typeof obj === 'object' && obj !== null && typeof (obj as AstNode).$type === 'string';
}

export function isReference(obj: unknown): obj is Reference {
    return typeof obj === 'object' && obj !== null && typeof (obj as Reference).$refText === 'string';
}

export function isAstNodeDescription(obj: unknown): obj is AstNodeDescription {
    return typeof obj === 'object' && obj !== null
        && typeof (obj as AstNodeDescription).name === 'string'
        && typeof (obj as AstNodeDescription).type === 'string'
        && typeof (obj as AstNodeDescription).path === 'string';
}

export function isLinkingError(obj: unknown): obj is LinkingError {
    return typeof obj === 'object' && obj !== null
        && isAstNode((obj as LinkingError).container)
        && isReference((obj as LinkingError).reference)
        && typeof (obj as LinkingError).message === 'string';
}

export function getContainerOfType<T extends AstNode>(node: AstNode | undefined, typePredicate: (n: AstNode) => n is T): T | undefined {
    let item = node;
    while (item) {
        if (typePredicate(item)) {
            return item;
        }
        item = item.$container;
    }
    return undefined;
}

export function hasContainerOfType(node: AstNode | undefined, predicate: (n: AstNode) => boolean): boolean {
    let item = node;
    while (item) {
        if (predicate(item)) {
            return true;
        }
        item = item.$container;
    }
    return false;
}

export function getDocument<T extends AstNode = AstNode>(node: AstNode): LangiumDocument<T> {
    let n = node;
    while (!n.$document && n.$container) {
        n = n.$container;
    }
    if (!n.$document) {
        throw new Error('AST node has no document.');
    }
    return n.$document as LangiumDocument<T>;
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

export function streamReferences(node: AstNode): Stream<ReferenceInfo> {
    type State = { keys: string[], keyIndex: number, arrayIndex: number };
    return new StreamImpl<State, ReferenceInfo>(() => ({
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

export async function resolveAllReferences(node: AstNode, cancelToken = CancellationToken.None): Promise<void> {
    const process = (n: AstNodeContent) => {
        streamReferences(n.node).forEach(r => {
            r.reference.ref; // Invoke the getter to link the target AstNode
        });
    };
    process({ node } as AstNodeContent);
    for (const content of streamAllContents(node)) {
        await interruptAndCheck(cancelToken);
        process(content);
    }
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
 * Returns a Stream of references to the target node from the AstNode tree
 *
 * @param targetNode AstNode we are looking for
 * @param lookup AstNode where we search for references. If not provided, the root node of the document is used as the default value
 */
export function findLocalReferences(targetNode: AstNode, lookup = getDocument(targetNode).parseResult.value): Stream<Reference> {
    const refs: Reference[] = [];
    const process = (node: AstNode) => {
        streamReferences(node).forEach(refInfo => {
            if (refInfo.reference.ref === targetNode) {
                refs.push(refInfo.reference);
            }
        });
    };
    process(lookup);
    streamAllContents(lookup).forEach(content => process(content.node));
    return stream(refs);
}
