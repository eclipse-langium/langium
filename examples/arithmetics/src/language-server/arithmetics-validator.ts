import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { ArithmeticsAstType, Division, isNumberLiteral, Definition, isFunctionCall, Expression, isAddition, Multiplication, Addition, Subtraction, isSubtraction, isMultiplication, isDivision } from './generated/ast';
import { ArithmeticsServices } from './arithmetics-module';

type LangiumGrammarChecks = { [type in ArithmeticsAstType]?: ValidationCheck | ValidationCheck[] }

export class ArithmeticsValidationRegistry extends ValidationRegistry {
    constructor(services: ArithmeticsServices) {
        super(services);
        const validator = services.validation.ArithmeticsValidator;
        const checks: LangiumGrammarChecks = {
            Division: validator.checkDivByZero,
            Definition: validator.checkNormalisable
        };
        this.register(checks, validator);
    }
}
export class ArithmeticsValidator {
    checkDivByZero(div: Division, accept: ValidationAcceptor): void {
        if (isNumberLiteral(div.right) && +div.right.value === 0) {
            accept('error', 'Division by zero is detected.', { node: div, property: 'right' });
        }
    }

    checkNormalisable(def: Definition, accept: ValidationAcceptor): void {
        const context = new Map<Expression, number>();

        const makeOp = (expr: Addition | Subtraction | Multiplication | Division, op: (x: number, y: number) => number): void => {
            const subExprs = [expr.left, expr.right];
            subExprs.forEach(e => evalExpr(e));
            const [left, right] = subExprs.map(e => isNumberLiteral(e) ? +e.value : context.get(e));
            if (left && right && op(left, right).toString().length <= 8) {
                context.set(expr, op(left, right));
                subExprs.forEach(e => context.delete(e));
            }
        };

        const evalExpr = (expr: Expression): void => {
            if (isFunctionCall(expr) || isNumberLiteral(expr)) return;
            if (isAddition(expr)) {
                makeOp(expr, (x, y) => x + y);
            } else if (isSubtraction(expr)) {
                makeOp(expr, (x, y) => x - y);
            } else if (isMultiplication(expr)) {
                makeOp(expr, (x, y) => x * y);
            } else if (isDivision(expr)) {
                makeOp(expr, (x, y) => x / y);
            }
        };

        evalExpr(def.expr);
        for (const [expr, result] of context) {
            if (result) {
                accept('warning', 'Expression could be normalized to constant ' + result, { node: expr });
            }
        }
    }
}