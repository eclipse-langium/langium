import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { RequirementsAndTestsAstType, Requirement, Test } from './generated/ast';
import { RequirementsLanguageServices, TestsLanguageServices } from './requirements-and-tests-language-module';

/**
 * Registry for validation checks.
 */
 export class RequirementsLanguageValidationRegistry extends ValidationRegistry {
    constructor(services: RequirementsLanguageServices) {
        super(services);
        const validator = services.validation.RequirementsLanguageValidator;
        const checks: ValidationChecks<RequirementsAndTestsAstType> = {
            Requirement: validator.checkRequirementNameContainsANumber
        };
        this.register(checks, validator);
    }
}
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
 export class RequirementsLanguageValidator {

    checkRequirementNameContainsANumber(requirement: Requirement, accept: ValidationAcceptor): void {
        if (requirement.name) {
            if (!/.*\d.*/.test(requirement.name)) {
                accept('warning', 'Requirement name should container a number.', { node: requirement, property: 'name' });
            }
        }
    }

}
export class TestsLanguageValidator {

    checkTestNameContainsANumber(test: Test, accept: ValidationAcceptor): void {
        if (test.name) {
            if (!/.*\d.*/.test(test.name)) {
                accept('warning', 'Test name should container a number.', { node: test, property: 'name' });
            }
        }
    }

}
