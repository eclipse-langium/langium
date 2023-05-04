/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { ArithmeticsAstType, Definition, Expression, BinaryExpression, Module } from './generated/ast';
import type { ArithmeticsServices } from './arithmetics-module';
import { MultiMap } from 'langium';
import { isNumberLiteral, isFunctionCall, isBinaryExpression } from './generated/ast';
import { applyOp } from './arithmetics-util';

export function registerValidationChecks(services: ArithmeticsServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.ArithmeticsValidator;
    const checks: ValidationChecks<ArithmeticsAstType> = {
        BinaryExpression: validator.checkDivByZero,
        Definition: validator.checkNormalisable,
        Module: validator.checkUniqueDefinitions
    };
    registry.register(checks, validator);
}

export class ArithmeticsValidator {
    checkDivByZero(binExpr: BinaryExpression, accept: ValidationAcceptor): void {
        if (binExpr.operator === '/' && isNumberLiteral(binExpr.right) && binExpr.right.value === 0) {
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
}
