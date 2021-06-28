import { AbstractDefinition, Addition, Definition, Division, Evaluation, Expression, FunctionCall, isAddition, isDefinition, isDivision, isEvaluation, isFunctionCall, isMultiplication, isNumberLiteral, isSubtraction, Module, Multiplication, NumberLiteral, Statement, Subtraction } from './language-server/generated/ast';

export class ArithmeticsInterpreter {
    // variable name --> value
    private context: Map<string, number | Definition>;
    // expression --> value
    private res = new Map<string, number>();

    constructor(context: Map<string, number | Definition> = new Map<string, number | Definition>()) {
        this.context = context;
    }

    public eval(module: Module): Map<string, number> {
        module.statements.forEach(stmt => this.evalStatement(stmt));
        return this.res;
    }

    private evalStatement(stmt: Statement): void {
        if (isDefinition(stmt)) {
            this.evalDefinition(stmt as Definition);
        } else if (isEvaluation(stmt)) {
            this.evalEvaluation(stmt as Evaluation);
        }
    }

    private evalDefinition(def: Definition): void {
        this.context.set(def.name, def.args.length > 0 ? def : this.evalExpression(def.expr));
    }

    private evalEvaluation(evaluation: Evaluation): void {
        const expr = evaluation.expression;
        if (expr.$cstNode?.text) {
            this.res.set(expr.$cstNode?.text, this.evalExpression(expr));
        }
    }

    private evalExpression(expr: Expression): number {
        if (isAddition(expr)) {
            const castedExpr = expr as Addition;
            const left = this.evalExpression(castedExpr.left);
            const right = this.evalExpression(castedExpr.right);
            return right ? left + right : left;
        }
        if (isSubtraction(expr)) {
            const castedExpr = expr as Subtraction;
            const left = this.evalExpression(castedExpr.left);
            const right = this.evalExpression(castedExpr.right);
            return right ? left - right : left;
        }
        if (isMultiplication(expr)) {
            const castedExpr = expr as Multiplication;
            const left = this.evalExpression(castedExpr.left);
            const right = this.evalExpression(castedExpr.right);
            return right ? left * right : left;
        }
        if (isDivision(expr)) {
            const castedExpr = expr as Division;
            const left = this.evalExpression(castedExpr.left);
            const right = this.evalExpression(castedExpr.right);
            return right ? left / right : left;
        }
        if (isNumberLiteral(expr)) {
            return +(expr as NumberLiteral).value;
        }
        if (isFunctionCall(expr)) {
            const funcCall = expr as FunctionCall;
            const valueOrDef = this.context.get((funcCall.func.ref as AbstractDefinition).name) as number | Definition;
            if (!isDefinition(valueOrDef)) {
                return valueOrDef;
            }
            if (valueOrDef.args.length !== funcCall.args.length) {
                console.log('Function definition and call have different number of arguments: ' + valueOrDef.name);
                process.exit(1);
            }

            const backupContext = new Map<string, number | Definition>();
            for (let i = 0; i < valueOrDef.args.length; i += 1) {
                backupContext.set(valueOrDef.args[i].name, this.evalExpression(funcCall.args[i]));
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

        console.log('Impossible type of Expression.');
        process.exit(1);
    }
}