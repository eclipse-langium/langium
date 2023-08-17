/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { RequirementsAndTestsAstType, Test } from './generated/ast.js';
import type { TestsLangServices } from './tests-lang-module.js';

export function registerTestsValidationChecks(services: TestsLangServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.TestsLangValidator;
    const checks: ValidationChecks<RequirementsAndTestsAstType> = {
        Test: [
            validator.checkTestNameContainsANumber,
            validator.checkTestReferencesOnlyEnvironmentsAlsoReferencedInSomeRequirement
        ]
    };
    registry.register(checks, validator);
}

export class TestsLangValidator {

    checkTestNameContainsANumber(test: Test, accept: ValidationAcceptor): void {
        if (test.name) {
            if (!/.*\d.*/.test(test.name)) {
                accept('warning', `Test name ${test.name} should container a number.`, { node: test, property: 'name' });
            }
        }
    }

    checkTestReferencesOnlyEnvironmentsAlsoReferencedInSomeRequirement(test: Test, accept: ValidationAcceptor): void {
        test.environments.forEach((environmentReference, index) => {
            if (environmentReference.ref) {
                if (!test.requirements.some(requirementReference => {
                    return requirementReference.ref && requirementReference.ref.environments.map(v => v.ref).includes(environmentReference.ref);
                })) {
                    accept('warning', `Test ${test.name} references environment ${environmentReference.ref.name} which is used in any referenced requirement.`, { node: test, property: 'environments', index: index });
                }
            }
        });
    }

}
