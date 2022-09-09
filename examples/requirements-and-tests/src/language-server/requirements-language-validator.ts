import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { RequirementsAndTestsAstType, Requirement } from './generated/ast';
import { RequirementsLanguageServices } from './requirements-language-module';

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
