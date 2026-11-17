/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

// Internal helpers for walking an AST with an explicit stack. This module is deliberately not re-exported
// from `utils/index.ts` (and so not part of `AstUtils`), so its functions are not part of the public API.

import type { AstNode, GenericAstNode } from '../syntax-tree.js';
import { isAstNode } from '../syntax-tree.js';

/**
 * Pushes the children of `node` onto `stack`, so that popping the stack yields them in document order,
 * i.e. in the order of `streamContents(node)`: the first child ends up on top.
 *
 * The children are the AST nodes held by the own properties of `node`, directly or in an array, except for
 * the properties whose name starts with `$`. The properties are read in `for…in` order, which for own
 * properties is the order of `Object.keys`.
 *
 * The children are pushed in that order and then that part of the stack is reversed, so that no
 * temporary array is needed.
 */
export function pushChildrenInDocumentOrder(stack: AstNode[], node: AstNode): void {
    const first = stack.length;
    for (const property in node) {
        // own properties only, to match `streamContents`/`streamAst`
        if (property.charCodeAt(0) === 36 /* '$' */
            || !Object.prototype.hasOwnProperty.call(node, property)) {
            continue;
        }
        const value = (node as GenericAstNode)[property];
        if (isAstNode(value)) {
            stack.push(value);
        } else if (Array.isArray(value)) {
            for (const element of value) {
                if (isAstNode(element)) {
                    stack.push(element);
                }
            }
        }
    }
    for (let lo = first, hi = stack.length - 1; lo < hi; lo++, hi--) {
        const swap = stack[lo];
        stack[lo] = stack[hi];
        stack[hi] = swap;
    }
}
