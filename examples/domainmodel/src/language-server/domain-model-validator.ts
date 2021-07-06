/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { DomainModelAstType, Type } from './generated/ast';
import { DomainModelServices } from './domain-model-module';

type DomainModelChecks = { [type in DomainModelAstType]?: ValidationCheck | ValidationCheck[] }

export class DomainModelValidationRegistry extends ValidationRegistry {
    constructor(services: DomainModelServices) {
        super(services);
        const validator = services.validation.DomainModelValidator;
        const checks: DomainModelChecks = {
            Type: validator.checkTypeStartsWithCapital
        };
        this.register(checks, validator);
    }
}

export class DomainModelValidator {

    checkTypeStartsWithCapital(type: Type, accept: ValidationAcceptor): void {
        if (type.name) {
            const firstChar = type.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Type name should start with a capital.', { node: type, property: 'name' });
            }
        }
    }

}
