/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Reference, ValidationAcceptor, ValidationChecks } from 'langium';
import { MultiMap, stream } from 'langium';
import { evalExpression } from './arithmetics-evaluator.js';
import type { ArithmeticsServices } from './arithmetics-module.js';
import { applyOp } from './arithmetics-util.js';
import type { ArithmeticsAstType, BinaryExpression, DeclaredParameter, Definition, Expression, FunctionCall, Module } from './generated/ast.js';
import { isBinaryExpression, isDefinition, isFunctionCall, isNumberLiteral } from './generated/ast.js';

export function registerValidationChecks(services: ArithmeticsServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.ArithmeticsValidator;
    const checks: ValidationChecks<ArithmeticsAstType> = {
        BinaryExpression: validator.checkDivByZero,
        Definition: [validator.checkUniqueParmeters, validator.checkNormalisable],
        Module: [validator.checkUniqueDefinitions, validator.checkFunctionRecursion],
        FunctionCall: validator.checkMatchingParameters,
    };
    registry.register(checks, validator);
}

export class ArithmeticsValidator {
    checkDivByZero(binExpr: BinaryExpression, accept: ValidationAcceptor): void {
        if ((binExpr.operator === '/' || binExpr.operator === '%') && evalExpression(binExpr.right) === 0) {
            accept('error', 'Division by zero is detected.', { node: binExpr, property: 'right' });
        }
    }

    checkNormalisable(def: Definition, accept: ValidationAcceptor): void {
        const context = new Map<Expression, number>();

        const makeOp = (expr: BinaryExpression, op: (x: number, y: number) => number): void => {
            const subExprs = [expr.left, expr.right];
            subExprs.forEach(e => evalExpr(e));
            const [left, right] = subExprs.map(e => isNumberLiteral(e) ? e.value : context.get(e));
            if (left !== undefined && right !== undefined && op(left, right).toString().length <= 8) {
                context.set(expr, op(left, right));
                subExprs.forEach(e => context.delete(e));
            }
        };

        const evalExpr = (expr: Expression): void => {
            if (isFunctionCall(expr) || isNumberLiteral(expr)) return;
            if (isBinaryExpression(expr)) makeOp(expr, applyOp(expr.operator));
        };

        evalExpr(def.expr);
        for (const [expr, result] of context) {
            if (result) {
                accept('warning', 'Expression could be normalized to constant ' + result, { node: expr });
            }
        }
    }

    checkUniqueDefinitions(module: Module, accept: ValidationAcceptor): void {
        const names = new MultiMap<string, Definition>();
        for (const def of module.statements as Definition[]) {
            if (def.name) names.add(def.name, def);
        }
        for (const [name, symbols] of names.entriesGroupedByKey()) {
            if (symbols.length > 1) {
                for (const symbol of symbols) {
                    accept('error', `Duplicate definition name: ${name}`, { node: symbol, property: 'name' });
                }
            }
        }
    }

    checkFunctionRecursion(module: Module, accept: ValidationAcceptor): void {

        function* getNestedCalls(host: Definition, expression: Expression = host.expr): Generator<NestedFunctionCall> {
            if (isFunctionCall(expression)) {
                if (isResolvedFunctionCall(expression)) yield { call: expression, host };
            } else if (isBinaryExpression(expression)) {
                for (const expr of [expression.left, expression.right]) {
                    if (expr) yield* getNestedCalls(host, expr);
                }
            }
        }

        const traversedFunctions = new Set<Definition>();
        function* getNestedCallsIfUnprocessed(func: Definition): Generator<NestedFunctionCall> {
            if (!traversedFunctions.has(func)) {
                traversedFunctions.add(func);
                yield* getNestedCalls(func);
            }
        }

        const callsTree = new Map<ResolvedFunctionCall, NestedFunctionCall>();
        const getCycle = (to: NestedFunctionCall): [NestedFunctionCall, NestedFunctionCall] | undefined => {
            const referencedFunc = to.call.func.ref;
            let parent = callsTree.get(to.call);
            while (parent) {
                if (parent.host === referencedFunc) return [parent, to];
                parent = callsTree.get(parent.call);
            }
            return undefined;
        };

        const callCycles: NestedFunctionCall[][] = [];
        const printCycle = (cycle: NestedFunctionCall[]): string => {
            const start = cycle[0];
            const end = cycle[cycle.length - 1];
            if (start === end) return printNestedFunctionCall(start);
            let printedCycle = printNestedFunctionCall(end);
            let parent = callsTree.get(end.call);
            while (parent) {
                printedCycle = printNestedFunctionCall(parent) + '->' + printedCycle;
                if (parent.call === start.call) break;
                parent = callsTree.get(parent.call);
            }
            return printedCycle;
        };

        const bfsStep = (parent: NestedFunctionCall): NestedFunctionCall[] => {
            const referencedFunc = parent.call.func.ref;
            const uncycledChildren: NestedFunctionCall[] = [];
            if (parent.host === referencedFunc) callCycles.push([parent]);
            else for (const child of getNestedCallsIfUnprocessed(referencedFunc)) {
                callsTree.set(child.call, parent);
                const callCycle = getCycle(child);
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
            .flatMap(getNestedCallsIfUnprocessed)
            .forEach(call => {
                let remainingCalls = Array.of(call);
                while (remainingCalls.length !== 0) {
                    remainingCalls = remainingCalls.flatMap(bfsStep);
                }
            });

        for (const cycle of callCycles) {
            const cycleMessage = printCycle(cycle);
            for (const { call } of cycle) {
                accept('error', `Recursion is not allowed [${cycleMessage}]`, { node: call, property: 'func' });
            }
        }
    }

    checkUniqueParmeters(abstractDefinition: Definition, accept: ValidationAcceptor): void {
        const names = new MultiMap<string, DeclaredParameter>();
        for (const def of abstractDefinition.args) {
            if (def.name) names.add(def.name, def);
        }
        for (const [name, symbols] of names.entriesGroupedByKey()) {
            if (symbols.length > 1) {
                for (const symbol of symbols) {
                    accept('error', `Duplicate definition name: ${name}`, { node: symbol, property: 'name' });
                }
            }
        }
    }

    checkMatchingParameters(functionCall: FunctionCall, accept: ValidationAcceptor): void {
        if (!functionCall.func.ref || !(functionCall.func.ref as Definition).args) return;
        if (functionCall.args.length !== (functionCall.func.ref as Definition).args.length) {
            accept('error', `Function ${functionCall.func.ref?.name} expects ${functionCall.args.length} parameters, but ${(functionCall.func.ref as Definition).args.length} were given.`, { node: functionCall, property: 'args' });
        }
    }
}
type NestedFunctionCall = {
    call: ResolvedFunctionCall,
    host: Definition
}
function printNestedFunctionCall({ host, call }: NestedFunctionCall): string {
    return `${host.name}::${call.func.ref.name}()`;
}
type ResolvedFunctionCall = FunctionCall & {
    func: ResolvedReference<Definition>
}
function isResolvedFunctionCall(functionCall: FunctionCall): functionCall is ResolvedFunctionCall {
    return isDefinition(functionCall.func.ref);
}
type ResolvedReference<T extends AstNode = AstNode> = Reference<T> & {
    readonly ref: T;
}
