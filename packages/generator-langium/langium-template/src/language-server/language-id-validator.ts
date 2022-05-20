import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { <%= LanguageName %>AstType, Person } from './generated/ast';
import type { <%= LanguageName %>Services } from './<%= language-id %>-module';

/**
 * Registry for validation checks.
 */
export class <%= LanguageName %>ValidationRegistry extends ValidationRegistry {
    constructor(services: <%= LanguageName %>Services) {
        super(services);
        const validator = services.validation.<%= LanguageName %>Validator;
        const checks: ValidationChecks<<%= LanguageName %>AstType> = {
            Person: validator.checkPersonStartsWithCapital
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
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
