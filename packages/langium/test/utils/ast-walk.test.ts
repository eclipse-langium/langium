/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Reference } from '../../src/syntax-tree.js';
import { streamAst, streamContents } from '../../src/utils/ast-utils.js';
import { pushChildrenInDocumentOrder } from '../../src/utils/ast-walk.js';
import { describe, expect, test } from 'vitest';

function node(name: string, properties: Record<string, unknown> = {}): AstNode {
    return { $type: 'Node', name, ...properties } as AstNode;
}

function nameOf(astNode: AstNode): string {
    return (astNode as AstNode & { name: string }).name;
}

/** Pushes the children of `parent` onto `stack` and pops everything that was pushed. */
function popChildren(parent: AstNode, stack: AstNode[] = []): string[] {
    const before = stack.length;
    pushChildrenInDocumentOrder(stack, parent);
    const popped: string[] = [];
    while (stack.length > before) {
        popped.push(nameOf(stack.pop()!));
    }
    return popped;
}

describe('pushChildrenInDocumentOrder', () => {

    test('pushes the children so that they are popped in document order, like streamContents yields them', () => {
        const parent = node('parent', {
            first: node('a'),
            many: [node('b'), node('c'), node('d')],
            second: node('e'),
            more: [node('f'), node('g')]
        });
        const expected = streamContents(parent).map(nameOf).toArray();
        expect(expected).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
        expect(popChildren(parent)).toEqual(expected);
    });

    test('pushes the child objects themselves', () => {
        const children = [node('a'), node('b')];
        const parent = node('parent', { children });
        const stack: AstNode[] = [];
        pushChildrenInDocumentOrder(stack, parent);
        expect(stack).toHaveLength(2);
        expect(stack[1]).toBe(children[0]);
        expect(stack[0]).toBe(children[1]);
    });

    test.each([0, 1, 2, 3, 4, 5])('keeps the entries below on the stack and their order, with %i children', count => {
        const parent = node('parent', { children: Array.from({ length: count }, (_, i) => node(`c${i}`)) });
        const below = [node('x'), node('y'), node('z')];
        const stack = [...below];
        expect(popChildren(parent, stack)).toEqual(Array.from({ length: count }, (_, i) => `c${i}`));
        expect(stack).toEqual(below);
        stack.forEach((entry, i) => expect(entry).toBe(below[i]));
    });

    test('pushes nothing for a node without children', () => {
        const stack = [node('x')];
        pushChildrenInDocumentOrder(stack, node('leaf', { text: 'value', numbers: [1, 2], empty: [] }));
        expect(stack.map(nameOf)).toEqual(['x']);
    });

    test('pushes only AST nodes, also from arrays', () => {
        const reference = { $refText: 'a', ref: undefined } as unknown as Reference;
        const parent = node('parent', {
            text: 'not a node',
            reference,
            nothing: undefined,
            empty: [],
            mixed: ['text', node('a'), 42, reference, null, node('b')],
            object: { name: 'no $type' },
            last: node('c')
        });
        expect(popChildren(parent)).toEqual(['a', 'b', 'c']);
    });

    test('skips properties whose name starts with $', () => {
        const container = node('container');
        const parent = node('parent', {
            $container: container,
            $hiddenChild: node('hiddenChild'),
            $hiddenChildren: [node('hidden1'), node('hidden2')],
            child: node('child')
        });
        expect(streamContents(parent).map(nameOf).toArray()).toEqual(['child']);
        expect(popChildren(parent)).toEqual(['child']);
    });

    test('skips inherited properties, like streamContents', () => {
        const prototype = { inherited: node('inherited'), inheritedChildren: [node('inherited1')] };
        const parent = Object.assign(Object.create(prototype) as AstNode, {
            $type: 'Node',
            name: 'parent',
            own: node('own'),
            ownChildren: [node('own1'), node('own2')]
        });
        expect(streamContents(parent).map(nameOf).toArray()).toEqual(['own', 'own1', 'own2']);
        expect(popChildren(parent)).toEqual(['own', 'own1', 'own2']);
    });

    test('a stack walk with it visits the nodes in the order of streamAst', () => {
        const root = node('root', {
            a: node('a', { items: [node('a1', { deep: node('a1x') }), node('a2')] }),
            b: [node('b1'), node('b2', { items: [node('b2a'), node('b2b', { last: node('b2bx') })] })],
            c: node('c')
        });
        const visited: string[] = [];
        const stack: AstNode[] = [root];
        while (stack.length > 0) {
            const current = stack.pop()!;
            visited.push(nameOf(current));
            pushChildrenInDocumentOrder(stack, current);
        }
        expect(visited).toEqual(streamAst(root).map(nameOf).toArray());
        expect(visited).toEqual(['root', 'a', 'a1', 'a1x', 'a2', 'b1', 'b2', 'b2a', 'b2b', 'b2bx', 'c']);
    });
});
