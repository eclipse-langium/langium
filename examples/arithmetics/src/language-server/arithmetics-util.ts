/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ResolvedReference } from 'langium';
import { isDefinition, type BinaryExpression, type Definition, type FunctionCall } from './generated/ast.js';

export function applyOp(op: BinaryExpression['operator']): (x: number, y: number) => number {
    switch (op) {
        case '+': return (x, y) => x + y;
        case '-': return (x, y) => x - y;
        case '*': return (x, y) => x * y;
        case '^': return (x, y) => Math.pow(x, y);
        case '%': return (x, y) => x % y;
        case '/': return (x, y) => {
            if (y === 0) {
                throw new Error('Division by zero');
            }
            return x / y;
        };
        default: throw new Error('Unknown operator: ' + op);
    }
}

export type ResolvedFunctionCall = FunctionCall & {
    func: ResolvedReference<Definition>
}

export function isResolvedFunctionCall(functionCall: FunctionCall): functionCall is ResolvedFunctionCall {
    return isDefinition(functionCall.func.ref);
}
