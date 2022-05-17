/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CstNode } from '..';

export class ErrorWithLocation extends Error {
    constructor(node: CstNode|undefined, message: string) {
        super(`${message} at ${node?.range.start.line || 0}:${node?.range.start.character || 0}`);
    }
}

export function assertUnreachable(_: never): never {
    throw new Error('Error! Please fulfill the logic also for the other types in the inheritence hierarchy.');
}