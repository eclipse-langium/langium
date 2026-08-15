/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CstNode } from '../syntax-tree.js';

export class ErrorWithLocation extends Error {
    constructor(node: CstNode | undefined, message: string | (() => string)) {
        const msg = typeof message === 'string' ? message : message();
        super(node ? `${msg} at ${node.range.start.line}:${node.range.start.character}` : msg);
    }
}

export function assertUnreachable(_: never, message: string | (() => string) = 'Error: Got unexpected value.'): never {
    throw new Error(typeof message === 'string' ? message : message());
}

export function assertCondition(condition: boolean, message: string | (() => string) = 'Error: Condition is violated.'): asserts condition {
    if (!condition) {
        throw new Error(typeof message === 'string' ? message : message());
    }
}
