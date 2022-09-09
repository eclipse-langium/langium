import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { RequirementsAndTestsAstType, Requirement, isTestModel } from './generated/ast';
import { RequirementsLanguageServices } from './requirements-language-module';

/**
 * Registry for validation checks.
 */
export class RequirementsLanguageValidationRegistry extends ValidationRegistry {
    constructor(services: RequirementsLanguageServices) {
        super(services);
        const validator = services.validation.RequirementsLanguageValidator;
        const checks: ValidationChecks<RequirementsAndTestsAstType> = {
            Requirement: [
                validator.checkRequirementNameContainsANumber,
                validator.checkRequirementIsCoveredByATest
            ]
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
 export class RequirementsLanguageValidator {

    constructor(private services: RequirementsLanguageServices) {}

    checkRequirementNameContainsANumber(requirement: Requirement, accept: ValidationAcceptor): void {
        if (requirement.name) {
            if (!/.*\d.*/.test(requirement.name)) {
                accept('warning', 'Requirement name should container a number.', { node: requirement, property: 'name' });
            }
        }
    }

    checkRequirementIsCoveredByATest(requirement: Requirement, accept: ValidationAcceptor): void {
        let ok = false;
        this.services.shared.workspace.LangiumDocuments.all.map(doc=>doc.parseResult?.value).filter(isTestModel).forEach(testModel=>{
            testModel.tests.forEach(test=>{
                if (test.requirements.map(r=>r.ref).includes(requirement)) {
                    ok = true;
                }
            })
        })
        if (!ok) {
            accept('warning', `Requirement ${requirement.name} not covered by a test.`, { node: requirement });
        }
    }
}
