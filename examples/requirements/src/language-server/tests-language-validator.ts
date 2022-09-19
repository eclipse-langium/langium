/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

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
            Test: [
                validator.checkTestNameContainsANumber,
                validator.checkTestReferencesOnlyEnvironmentsAlsoReferencedInSomeRequirement
            ]
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
                accept('warning', `Test name ${test.name} should container a number.`, { node: test, property: 'name' });
            }
        }
    }

    checkTestReferencesOnlyEnvironmentsAlsoReferencedInSomeRequirement(test: Test, accept: ValidationAcceptor): void {
        test.environments.forEach((environmentReference, index)=>{
            if (environmentReference.ref) {
                if (!test.requirements.some(requirementReference=>{
                    return requirementReference.ref && requirementReference.ref.environments.map(v=>v.ref).includes(environmentReference.ref);
                })) {
                    accept('warning', `Test ${test.name} references environment ${environmentReference.ref.name} which is used in any referenced requirement.`, { node: test, property: "environments", index: index });
                }
            }
        })
    }

}
