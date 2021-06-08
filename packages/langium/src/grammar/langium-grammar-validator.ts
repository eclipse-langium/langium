import { AbstractRule, Grammar, LangiumGrammarAstType } from './generated/ast';
import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from '../service/validation/validation-registry';
import { LangiumGrammarServices } from './langium-grammar-module';

type LangiumGrammarChecks = { [type in LangiumGrammarAstType]?: ValidationCheck | ValidationCheck[] }

export class LangiumGrammarValidationRegistry extends ValidationRegistry {
    constructor(services: LangiumGrammarServices) {
        super(services);
        const validator = services.validation.LangiumGrammarValidator;
        const checks: LangiumGrammarChecks = {
            AbstractRule: validator.checkRule,
            Grammar: validator.checkGrammar
        };
        this.register(checks, validator);
    }
}

export class LangiumGrammarValidator {

    checkGrammar(grammar: Grammar, accept: ValidationAcceptor): void {
        if (grammar.name) {
            const firstChar = grammar.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Grammar name should start with an upper case letter.', { node: grammar, property: 'name' });
            }
        }
    }

    checkRule(rule: AbstractRule, accept: ValidationAcceptor): void {
        if (rule.name) {
            const firstChar = rule.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Rule name should start with an upper case letter.', { node: rule, property: 'name' });
            }
        }
    }

}
