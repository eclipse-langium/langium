import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { RequirementsAndTestsAstType, Test } from './generated/ast';
import { TestsLanguageServices } from './tests-language-module';

/**
 * Registry for validation checks.
 */
export class TestsLanguageValidationRegistry extends ValidationRegistry {
    constructor(services: TestsLanguageServices) {
        super(services);
        const validator = services.validation.TestsLanguageValidator;
        const checks: ValidationChecks<RequirementsAndTestsAstType> = {
            Test: validator.checkTestNameContainsANumber
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
export class TestsLanguageValidator {

    checkTestNameContainsANumber(test: Test, accept: ValidationAcceptor): void {
        if (test.name) {
            if (!/.*\d.*/.test(test.name)) {
                accept('warning', 'Test name should container a number.', { node: test, property: 'name' });
            }
        }
    }

}
