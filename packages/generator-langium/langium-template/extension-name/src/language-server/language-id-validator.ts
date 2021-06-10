import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { LanguageNameAstType, Person } from './generated/ast';
import { LanguageNameServices } from './language-id-module';

type LangiumGrammarChecks = { [type in LanguageNameAstType]?: ValidationCheck | ValidationCheck[] }

export class LanguageNameValidationRegistry extends ValidationRegistry {
    constructor(services: LanguageNameServices) {
        super(services);
        const validator = services.validation.LanguageNameValidator;
        const checks: LangiumGrammarChecks = {
            Person: validator.checkPersonStartsWithCapital
        };
        this.register(checks, validator);
    }
}

export class LanguageNameValidator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
	}

}
