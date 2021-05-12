import { AstNode } from './ast-node';
import { Stream, StreamImpl, DONE_RESULT, TreeStream, TreeStreamImpl } from '../utils/stream';
import { LangiumDocument } from '../references/scope';

export function isAstNode(obj: unknown): obj is AstNode {
    return typeof obj === 'object' && typeof (obj as AstNode).$type === 'string';
}

/** TODO link document to root node so it's accessible from every AST node */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDocument(node: AstNode): LangiumDocument {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return null!;
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
