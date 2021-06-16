import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { <%= LanguageName %>AstType, Person } from './generated/ast';
import { <%= LanguageName %>Services } from './<%= language-id %>-module';

type LangiumGrammarChecks = { [type in <%= LanguageName %>AstType]?: ValidationCheck | ValidationCheck[] }

export class <%= LanguageName %>ValidationRegistry extends ValidationRegistry {
    constructor(services: <%= LanguageName %>Services) {
        super(services);
        const validator = services.validation.<%= LanguageName %>Validator;
        const checks: LangiumGrammarChecks = {
            Person: validator.checkPersonStartsWithCapital
        };
        this.register(checks, validator);
    }
}

export class <%= LanguageName %>Validator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
	}

}
