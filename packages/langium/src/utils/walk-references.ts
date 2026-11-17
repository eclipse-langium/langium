/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

// Internal: this module is deliberately not re-exported from `utils/index.ts` (and so not part of `AstUtils`),
// so `walkReferences` and the restriction on its `action` are not part of the public API.

import type { AstNode, GenericAstNode, ReferenceInfo } from '../syntax-tree.js';
import { isMultiReference, isReference } from '../syntax-tree.js';
import { pushChildrenInDocumentOrder } from './ast-walk.js';
import { CancellationToken } from './cancellation.js';
import { interruptAndCheck, interruptionDue } from './promise-utils.js';

/**
 * Calls `action` for every cross-reference held by the given root node or any node contained in it.
 * The references are visited in the same order as by
 * ```ts
 * for (const node of streamAst(root)) {
 *     await interruptAndCheck(cancelToken);
 *     streamReferences(node).forEach(action);
 * }
 * ```
 * and the walk yields to the event loop and throws `OperationCancelled` at the same nodes as that loop,
 * but it creates no promise, stream or iterator per node: it awaits `interruptAndCheck` only when
 * {@link interruptionDue} says that it would yield or throw.
 *
 * The children of a node are read when the node is visited, i.e. after `action` was called for its
 * references, while `streamAst` reads each child only once the subtree of the previous child is done.
 * Therefore `action` must not add, remove or replace contained AST nodes.
 */
export async function walkReferences(root: AstNode, action: (refInfo: ReferenceInfo) => void, cancelToken = CancellationToken.None): Promise<void> {
    const stack: AstNode[] = [root];
    while (stack.length > 0) {
        const node = stack.pop()!;
        if (interruptionDue(cancelToken)) {
            await interruptAndCheck(cancelToken);
        }
        // The references of the node, as `streamReferences` yields them
        for (const property in node) {
            // own properties only, to match `Object.keys`
            if (property.charCodeAt(0) === 36 /* '$' */ || !Object.prototype.hasOwnProperty.call(node, property)) {
                continue;
            }
            const value = (node as GenericAstNode)[property];
            if (isReference(value) || isMultiReference(value)) {
                action({ reference: value, container: node, property });
            } else if (Array.isArray(value)) {
                for (let index = 0; index < value.length; index++) {
                    const element = value[index];
                    if (isReference(element) || isMultiReference(element)) {
                        action({ reference: element, container: node, property, index });
                    }
                }
            }
        }
        // Then its children, so that they are visited in document order, as `streamAst` does
        pushChildrenInDocumentOrder(stack, node);
    }
}
