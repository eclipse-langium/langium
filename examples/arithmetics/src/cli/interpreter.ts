/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createArithmeticsServices } from '../language-server/arithmetics-module';
import { AbstractDefinition, Definition, Evaluation, Expression, isBinaryExpression, isDefinition, isEvaluation, isFunctionCall, isNumberLiteral, Module, Statement } from '../language-server/generated/ast';
import { ArithmeticsLanguageMetaData } from '../language-server/generated/module';
import { applyOp, extractDocument } from './cli-util';

export const evalAction = async (fileName: string): Promise<void> => {
    const services = createArithmeticsServices().arithmetics;
    const document = await extractDocument<Module>(fileName, ArithmeticsLanguageMetaData.fileExtensions, services);
    const module = document.parseResult.value;
    for (const [evaluation, value] of interpretEvaluations(module)) {
        const cstNode = evaluation.expression.$cstNode;
        if (cstNode) {
            const line = cstNode.range.start.line + 1;
            console.log(`line ${line}:`, cstNode.text.green, '===>', value);
        }
    }
};

export function interpretEvaluations(module: Module): Map<Evaluation, number> {
    const ctx = <InterpreterContext>{
        module,
        context: new Map<string, number | Definition>(),
        result: new Map<Evaluation, number>()
    };
    return evaluate(ctx);
}

interface InterpreterContext {
    module: Module,
    // variable name --> value
    context: Map<string, number | Definition>,
    // expression --> value
    result: Map<Evaluation, number>
}

function evaluate(ctx: InterpreterContext): Map<Evaluation, number> {
    ctx.module.statements.forEach(stmt => evalStatement(ctx, stmt));
    return ctx.result;
}

function evalStatement(ctx: InterpreterContext, stmt: Statement): void {
    if (isDefinition(stmt)) {
        evalDefinition(ctx, stmt);
    } else if (isEvaluation(stmt)) {
        evalEvaluation(ctx, stmt);
    } else {
        console.error('Impossible type of Statement.');
    }
}

function evalDefinition(ctx: InterpreterContext, def: Definition): void {
    ctx.context.set(def.name, def.args.length > 0 ? def : evalExpression(ctx, def.expr));
}

function evalEvaluation(ctx: InterpreterContext, evaluation: Evaluation): void {
    ctx.result.set(evaluation, evalExpression(ctx, evaluation.expression));
}

function evalExpression(ctx: InterpreterContext, expr: Expression): number {
    if (isBinaryExpression(expr)) {
        const left = evalExpression(ctx, expr.left);
        const right = evalExpression(ctx, expr.right);
        if (right === undefined) return left;
        return applyOp(expr.operator)(left, right);
    }
    if (isNumberLiteral(expr)) {
        return +expr.value;
    }
    if (isFunctionCall(expr)) {
        const valueOrDef = ctx.context.get((expr.func.ref as AbstractDefinition).name) as number | Definition;
        if (!isDefinition(valueOrDef)) {
            return valueOrDef;
        }
        if (valueOrDef.args.length !== expr.args.length) {
            console.error('Function definition and its call have different number of arguments: ' + valueOrDef.name);
            process.exit(1);
        }

        const localContext = new Map<string, number | Definition>(ctx.context);
        for (let i = 0; i < valueOrDef.args.length; i += 1) {
            localContext.set(valueOrDef.args[i].name, evalExpression(ctx, expr.args[i]));
        }
        return evalExpression({module: ctx.module, context: localContext, result: ctx.result}, valueOrDef.expr);
    }

    console.error('Impossible type of Expression.');
    process.exit(1);
}