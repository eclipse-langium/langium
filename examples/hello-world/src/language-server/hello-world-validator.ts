import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { HelloWorldAstType, Person } from './generated/ast';
import { HelloWorldServices } from './hello-world-module';

/**
 * Map AST node types to validation checks.
 */
type HelloWorldChecks = { [type in HelloWorldAstType]?: ValidationCheck | ValidationCheck[] }

/**
 * Registry for validation checks.
 */
export class HelloWorldValidationRegistry extends ValidationRegistry {
    constructor(services: HelloWorldServices) {
        super(services);
        const validator = services.validation.HelloWorldValidator;
        const checks: HelloWorldChecks = {
            Person: validator.checkPersonStartsWithCapital
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
export class HelloWorldValidator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
    }

}
