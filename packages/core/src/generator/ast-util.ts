import { AstNode, Reference } from './ast-node';
import { Stream, StreamImpl, DONE_RESULT, TreeStream, TreeStreamImpl } from '../utils/stream';
import { LangiumDocument } from '../documents/document';

export function isAstNode(obj: unknown): obj is AstNode {
    return typeof obj === 'object' && typeof (obj as AstNode).$type === 'string';
}

export function isReference(obj: unknown): obj is Reference {
    return typeof obj === 'object' && typeof (obj as Reference).$refName === 'string';
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
            const value = r.reference.value;
            if (value === undefined) {
                result.unresolved.push(r);
            }
        });
    };
    process({ node } as AstNodeContent);
    streamAllContents(node).forEach(process);
    return result;
}
