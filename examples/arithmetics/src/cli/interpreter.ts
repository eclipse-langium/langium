/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractDefinition, Definition, Evaluation, Expression, isAddition, isDefinition, isDivision, isEvaluation, isFunctionCall, isMultiplication, isNumberLiteral, isSubtraction, Module, Statement } from '../language-server/generated/ast';

export class ArithmeticsInterpreter {
    // variable name --> value
    private context: Map<string, number | Definition>;
    // expression --> value
    private result = new Map<Evaluation, number>();

    constructor(context: Map<string, number | Definition> = new Map<string, number | Definition>()) {
        this.context = context;
    }

    public eval(module: Module): Map<Evaluation, number> {
        module.statements.forEach(stmt => this.evalStatement(stmt));
        return this.result;
    }

    private evalStatement(stmt: Statement): void {
        if (isDefinition(stmt)) {
            this.evalDefinition(stmt);
        } else if (isEvaluation(stmt)) {
            this.evalEvaluation(stmt);
        }
    }

    private evalDefinition(def: Definition): void {
        this.context.set(def.name, def.args.length > 0 ? def : this.evalExpression(def.expr));
    }

    private evalEvaluation(evaluation: Evaluation): void {
        this.result.set(evaluation, this.evalExpression(evaluation.expression));
    }

    public evalExpression(expr: Expression): number {
        if (isAddition(expr)) {
            const left = this.evalExpression(expr.left);
            const right = this.evalExpression(expr.right);
            return right !== undefined ? left + right : left;
        }
        if (isSubtraction(expr)) {
            const left = this.evalExpression(expr.left);
            const right = this.evalExpression(expr.right);
            return right !== undefined ? left - right : left;
        }
        if (isMultiplication(expr)) {
            const left = this.evalExpression(expr.left);
            const right = this.evalExpression(expr.right);
            return right !== undefined ? left * right : left;
        }
        if (isDivision(expr)) {
            const left = this.evalExpression(expr.left);
            const right = this.evalExpression(expr.right);
            return right ? left / right : left;
        }
        if (isNumberLiteral(expr)) {
            return +expr.value;
        }
        if (isFunctionCall(expr)) {
            const valueOrDef = this.context.get((expr.func.ref as AbstractDefinition).name) as number | Definition;
            if (!isDefinition(valueOrDef)) {
                return valueOrDef;
            }
            if (valueOrDef.args.length !== expr.args.length) {
                console.error('Function definition and its call have different number of arguments: ' + valueOrDef.name);
                process.exit(1);
            }

            const backupContext = new Map<string, number | Definition>();
            for (let i = 0; i < valueOrDef.args.length; i += 1) {
                backupContext.set(valueOrDef.args[i].name, this.evalExpression(expr.args[i]));
            }
            for (const [variable, value] of this.context) {
                if (!backupContext.has(variable)) {
                    backupContext.set(variable, value);
                }
            }
            const funcCallRes = this.evalExpression(valueOrDef.expr);
            this.context = backupContext;
            return funcCallRes;
        }

        console.error('Impossible type of Expression.');
        process.exit(1);
    }
}