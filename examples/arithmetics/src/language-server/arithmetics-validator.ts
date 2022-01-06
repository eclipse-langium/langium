/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { ArithmeticsAstType, isNumberLiteral, Definition, isFunctionCall, Expression, BinaryExpression, isBinaryExpression } from './generated/ast';
import { ArithmeticsServices } from './arithmetics-module';
import { applyOp } from '../cli/cli-util';

type LangiumGrammarChecks = { [type in ArithmeticsAstType]?: ValidationCheck | ValidationCheck[] }

export class ArithmeticsValidationRegistry extends ValidationRegistry {
    constructor(services: ArithmeticsServices) {
        super(services);
        const validator = services.validation.ArithmeticsValidator;
        const checks: LangiumGrammarChecks = {
            BinaryExpression: validator.checkDivByZero,
            Definition: validator.checkNormalisable
        };
        this.register(checks, validator);
    }
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
}