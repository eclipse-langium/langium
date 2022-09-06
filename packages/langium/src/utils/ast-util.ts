/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AstNodeDescription, GenericAstNode, LinkingError, Reference, ReferenceInfo } from '../syntax-tree';
import { DONE_RESULT, Stream, stream, StreamImpl, TreeStream, TreeStreamImpl } from '../utils/stream';
import { LangiumDocument } from '../workspace/documents';

export type Mutable<T> = {
    -readonly [P in keyof T]: T[P]
};

export function isAstNode(obj: unknown): obj is AstNode {
    return typeof obj === 'object' && obj !== null && typeof (obj as AstNode).$type === 'string';
}

/**
 * Link the `$container` and other related properties of every AST node that is directly contained
 * in the given `node`.
 */
export function linkContentToContainer(node: AstNode): void {
    for (const [name, value] of Object.entries(node)) {
        if (!name.startsWith('$')) {
            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (isAstNode(item)) {
                        (item as Mutable<AstNode>).$container = node;
                        (item as Mutable<AstNode>).$containerProperty = name;
                        (item as Mutable<AstNode>).$containerIndex = index;
                    }
                });
            } else if (isAstNode(value)) {
                (value as Mutable<AstNode>).$container = node;
                (value as Mutable<AstNode>).$containerProperty = name;
            }
        }
    }
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

/**
 * Walk along the hierarchy of containers from the given AST node to the root and return the first
 * node that matches the type predicate. If the start node itself matches, it is returned.
 * If no container matches, `undefined` is returned.
 */
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

/**
 * Walk along the hierarchy of containers from the given AST node to the root and check for existence
 * of a container that matches the given predicate. The start node is included in the checks.
 */
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

/**
 * Retrieve the document in which the given AST node is contained. A reference to the document is
 * usually held by the root node of the AST.
 *
 * @throws an error if the node is not contained in a document.
 */
export function getDocument<T extends AstNode = AstNode>(node: AstNode): LangiumDocument<T> {
    const rootNode = findRootNode(node);
    const result = rootNode.$document;
    if (!result) {
        throw new Error('AST node has no document.');
    }
    return result as LangiumDocument<T>;
}

/**
 * Returns the root node of the given AST node by following the `$container` references.
 */
export function findRootNode(node: AstNode): AstNode {
    while (node.$container) {
        node = node.$container;
    }
    return node;
}

/**
 * Create a stream of all AST nodes that are directly contained in the given node. This includes
 * single-valued as well as multi-valued (array) properties.
 */
export function streamContents(node: AstNode): Stream<AstNode> {
    type State = { keys: string[], keyIndex: number, arrayIndex: number };
    return new StreamImpl<State, AstNode>(() => ({
        keys: Object.keys(node),
        keyIndex: 0,
        arrayIndex: 0
    }), state => {
        while (state.keyIndex < state.keys.length) {
            const property = state.keys[state.keyIndex];
            if (!property.startsWith('$')) {
                const value = (node as GenericAstNode)[property];
                if (isAstNode(value)) {
                    state.keyIndex++;
                    return { done: false, value };
                } else if (Array.isArray(value)) {
                    while (state.arrayIndex < value.length) {
                        const index = state.arrayIndex++;
                        const element = value[index];
                        if (isAstNode(element)) {
                            return { done: false, value: element };
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

/**
 * Create a stream of all AST nodes that are directly and indirectly contained in the given root node.
 * This does not include the root node itself.
 */
export function streamAllContents(root: AstNode): TreeStream<AstNode> {
    return new TreeStreamImpl(root, node => streamContents(node));
}

/**
 * Create a stream of all AST nodes that are directly and indirectly contained in the given root node,
 * including the root node itself.
 */
export function streamAst(root: AstNode): TreeStream<AstNode> {
    return new TreeStreamImpl(root, node => streamContents(node), { includeRoot: true });
}

/**
 * Create a stream of all cross-references that are held by the given AST node. This includes
 * single-valued as well as multi-valued (array) properties.
 */
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
                const value = (node as GenericAstNode)[property];
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

/**
 * Returns a Stream of references to the target node from the AstNode tree
 *
 * @param targetNode AstNode we are looking for
 * @param lookup AstNode where we search for references. If not provided, the root node of the document is used as the default value
 */
export function findLocalReferences(targetNode: AstNode, lookup = getDocument(targetNode).parseResult.value): Stream<Reference> {
    const refs: Reference[] = [];
    streamAst(lookup).forEach(node => {
        streamReferences(node).forEach(refInfo => {
            if (refInfo.reference.ref === targetNode) {
                refs.push(refInfo.reference);
            }
        });
    });
    return stream(refs);
}
