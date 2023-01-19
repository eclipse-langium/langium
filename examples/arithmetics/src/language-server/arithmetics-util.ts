/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export function applyOp(op: '+' | '-' | '*' | '/'): (x: number, y: number) => number {
    if (op === '+') return (x, y) => x + y;
    if (op === '-') return (x, y) => x - y;
    if (op === '*') return (x, y) => x * y;
    return (x, y) => y === 0 ? x : x / y;
}