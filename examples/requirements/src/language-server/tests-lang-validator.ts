/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { RequirementsAndTestsAstType, Test } from './generated/ast';
import { TestsLangServices } from './tests-lang-module';

/**
 * Registry for validation checks.
 */
export class TestsLangValidationRegistry extends ValidationRegistry {
    constructor(services: TestsLangServices) {
        super(services);
        const validator = services.validation.TestsLangValidator;
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
export class TestsLangValidator {

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
                    accept('warning', `Test ${test.name} references environment ${environmentReference.ref.name} which is used in any referenced requirement.`, { node: test, property: 'environments', index: index });
                }
            }
        });
    }

}
