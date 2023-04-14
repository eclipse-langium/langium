/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export function applyOp(op: '+' | '-' | '*' | '/' | '^' | '%'): (x: number, y: number) => number {
    switch (op) {
        case '+': return (x, y) => x + y;
        case '-': return (x, y) => x - y;
        case '*': return (x, y) => x * y;
        case '^': return (x, y) => Math.pow(x, y);
        case '%': return (x, y) => x % y;
        default: return (x, y) => y === 0 ? x : x / y;
    }
}