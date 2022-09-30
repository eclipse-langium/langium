/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { RequirementsAndTestsAstType, Requirement, isTestModel } from './generated/ast';
import { RequirementsLangServices } from './requirements-lang-module';

/**
 * Registry for validation checks.
 */
export class RequirementsLangValidationRegistry extends ValidationRegistry {
    constructor(services: RequirementsLangServices) {
        super(services);
        const validator = services.validation.RequirementsLangValidator;
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
export class RequirementsLangValidator {
    private services: RequirementsLangServices;

    constructor(services: RequirementsLangServices) {
        this.services = services;
    }

    checkRequirementNameContainsANumber(requirement: Requirement, accept: ValidationAcceptor): void {
        if (requirement.name) {
            if (!/.*\d.*/.test(requirement.name)) {
                accept('warning', `Requirement name ${requirement.name} should container a number.`, { node: requirement, property: 'name' });
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
            });
        });
        if (!ok) {
            accept('warning', `Requirement ${requirement.name} not covered by a test.`, { node: requirement });
        }
    }
}
