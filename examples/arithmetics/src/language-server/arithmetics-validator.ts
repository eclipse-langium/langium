import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { ArithmeticsAstType, Division, NumberLiteral, isNumberLiteral } from './generated/ast';
import { ArithmeticsServices } from './arithmetics-module';

type LangiumGrammarChecks = { [type in ArithmeticsAstType]?: ValidationCheck | ValidationCheck[] }

export class ArithmeticsValidationRegistry extends ValidationRegistry {
    constructor(services: ArithmeticsServices) {
        super(services);
        const validator = services.validation.ArithmeticsValidator;
        const checks: LangiumGrammarChecks = {
            Division: validator.checkDivByZero
        };
        this.register(checks, validator);
    }
}
export class ArithmeticsValidator {
    checkDivByZero(div: Division, accept: ValidationAcceptor): void {
        if (isNumberLiteral(div.right) && Number((div.right as NumberLiteral).value) === 0) {
            accept('error', 'Division by zero is detected.', { node: div, property: 'right' });
        }
    }
}