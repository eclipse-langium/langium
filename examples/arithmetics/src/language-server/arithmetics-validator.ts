/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ValidationAcceptor, ValidationChecks, OptionalAstNode } from 'langium';
import { MultiMap, stream } from 'langium';
import { evalExpression } from './arithmetics-evaluator.js';
import type { ArithmeticsServices } from './arithmetics-module.js';
import type { ResolvedFunctionCall } from './arithmetics-util.js';
import { applyOp, isResolvedFunctionCall } from './arithmetics-util.js';
import type { ArithmeticsAstType, BinaryExpression, DeclaredParameter, Definition, Expression, FunctionCall, Module } from './generated/ast.js';
import { isBinaryExpression, isDefinition, isFunctionCall, isNumberLiteral } from './generated/ast.js';

export function registerValidationChecks(services: ArithmeticsServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.ArithmeticsValidator;
    const checks: ValidationChecks<ArithmeticsAstType> = {
        BinaryExpression: validator.checkDivByZero,
        Definition: [validator.checkUniqueParameters, validator.checkNormalisable],
        Module: [validator.checkUniqueDefinitions, validator.checkFunctionRecursion],
        FunctionCall: validator.checkMatchingParameters,
    };
    registry.register(checks, validator);
}

export class ArithmeticsValidator {
    checkDivByZero(binExpr: OptionalAstNode<BinaryExpression>, accept: ValidationAcceptor): void {
        if (binExpr.right && (binExpr.operator === '/' || binExpr.operator === '%') && evalExpression(binExpr.right) === 0) {
            accept('error', 'Division by zero is detected.', { node: binExpr, property: 'right' });
        }
    }

    checkNormalisable(def: OptionalAstNode<Definition>, accept: ValidationAcceptor): void {
        const context = new Map<OptionalAstNode<Expression> | undefined, number>();

        const makeOp = (expr: OptionalAstNode<BinaryExpression>, op: (x: number, y: number) => number): void => {
            const subExprs = [expr.left, expr.right];
            subExprs.forEach(e => evalExpr(e));
            const [left, right] = subExprs.map(e => isNumberLiteral(e) ? e.value : context.get(e));
            if (left !== undefined && right !== undefined && op(left, right).toString().length <= 8) {
                context.set(expr, op(left, right));
                subExprs.forEach(e => context.delete(e));
            }
        };

        const evalExpr = (expr?: Expression): void => {
            if (isBinaryExpression(expr)) {
                makeOp(expr, applyOp(expr.operator));
            }
        };

        evalExpr(def.expr);
        for (const [expr, result] of context) {
            if (expr && result) {
                accept('warning', 'Expression could be normalized to constant ' + result, { node: expr });
            }
        }
    }

    checkUniqueDefinitions(module: OptionalAstNode<Module>, accept: ValidationAcceptor): void {
        const names = new MultiMap<string, Definition>();
        for (const def of module.statements) {
            if (isDefinition(def) && def.name) {
                names.add(def.name, def);
            }
        }
        for (const [name, symbols] of names.entriesGroupedByKey()) {
            if (symbols.length > 1) {
                for (const symbol of symbols) {
                    accept('error', `Duplicate definition name: ${name}`, { node: symbol, property: 'name' });
                }
            }
        }
    }

    checkFunctionRecursion(module: OptionalAstNode<Module>, accept: ValidationAcceptor): void {
        const traversedFunctions = new Set<Definition>();
        function* getNotTraversedNestedCalls(func: Definition): Generator<NestedFunctionCall> {
            if (!traversedFunctions.has(func)) {
                traversedFunctions.add(func);
                yield* NestedFunctionCall.selectCalls(func);
            }
        }

        const callsTree: FunctionCallTree = new Map<ResolvedFunctionCall, NestedFunctionCall>();
        const callCycles: FunctionCallCycle[] = [];
        const bfsStep = (parent: NestedFunctionCall): NestedFunctionCall[] => {
            const referencedFunc = parent.call.func.ref;
            const uncycledChildren: NestedFunctionCall[] = [];
            if (parent.host === referencedFunc) {
                callCycles.push([parent]);
            }
            for (const child of getNotTraversedNestedCalls(referencedFunc)) {
                callsTree.set(child.call, parent);
                const callCycle = FunctionCallCycle.select(child, callsTree);
                if (callCycle) {
                    callCycles.push(callCycle);
                } else {
                    uncycledChildren.push(child);
                }
            }
            return uncycledChildren;
        };

        stream(module.statements)
            .filter(isDefinition)
            .flatMap(getNotTraversedNestedCalls)
            .forEach(call => {
                let remainingCalls = Array.of(call);
                while (remainingCalls.length !== 0) {
                    remainingCalls = remainingCalls.flatMap(bfsStep);
                }
            });

        for (const cycle of callCycles) {
            const cycleMessage = FunctionCallCycle.print(cycle, callsTree);
            for (const { call } of FunctionCallCycle.iterateBack(cycle, callsTree)) {
                accept('error', `Recursion is not allowed [${cycleMessage}]`, { node: call, property: 'func' });
            }
        }
    }

    checkUniqueParameters(definition: OptionalAstNode<Definition>, accept: ValidationAcceptor): void {
        const names = new MultiMap<string, DeclaredParameter>();
        for (const def of definition.args) {
            if (def.name) {
                names.add(def.name, def);
            }
        }
        for (const [name, symbols] of names.entriesGroupedByKey()) {
            if (symbols.length > 1) {
                for (const symbol of symbols) {
                    accept('error', `Duplicate definition name: ${name}`, { node: symbol, property: 'name' });
                }
            }
        }
    }

    checkMatchingParameters(functionCall: OptionalAstNode<FunctionCall>, accept: ValidationAcceptor): void {
        if (!isResolvedFunctionCall(functionCall) || !functionCall.func.ref.args) {
            return;
        }
        if (functionCall.args.length !== functionCall.func.ref.args.length) {
            accept('error', `Function ${functionCall.func.ref.name} expects ${functionCall.func.ref.args.length} parameters, but ${functionCall.args.length} were given.`, { node: functionCall, property: 'args' });
        }
    }
}

type FunctionCallTree = Map<ResolvedFunctionCall, NestedFunctionCall>
type FunctionCallCycle = NestedFunctionCall[]
namespace FunctionCallCycle {

    export function select(to: NestedFunctionCall, tree: FunctionCallTree): FunctionCallCycle | undefined {
        const referencedFunc = to.call.func.ref;
        let parent = tree.get(to.call);
        while (parent) {
            if (parent.host === referencedFunc) {
                return [parent, to];
            }
            parent = tree.get(parent.call);
        }
        return undefined;
    }

    export function print(cycle: FunctionCallCycle, tree: FunctionCallTree): string {
        return stream(iterateBack(cycle, tree))
            .map(NestedFunctionCall.toString)
            .reduce((child, parent) => parent + '->' + child) ?? '';
    }

    export function* iterateBack(cycle: FunctionCallCycle, tree: FunctionCallTree): Generator<NestedFunctionCall> {
        const start = cycle[0];
        const end = cycle[cycle.length - 1];
        yield end;
        if (start === end) {
            return;
        }
        let parent = tree.get(end.call);
        while (parent) {
            yield parent;
            if (parent.call === start.call) {
                break;
            }
            parent = tree.get(parent.call);
        }
    }
}

type NestedFunctionCall = {
    call: ResolvedFunctionCall,
    host: Definition
}
namespace NestedFunctionCall {

    export function* selectCalls(host: Definition, expression: Expression = host.expr): Generator<NestedFunctionCall> {
        if (isFunctionCall(expression)) {
            if (isResolvedFunctionCall(expression)) {
                yield { call: expression, host };
            }
        } else if (isBinaryExpression(expression)) {
            for (const expr of [expression.left, expression.right]) {
                if (expr) {
                    yield* selectCalls(host, expr);
                }
            }
        }
    }

    export function toString({ call }: NestedFunctionCall): string {
        return `${call.func.ref.name}()`;
    }
}
