/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { DomainModelAstType, Type } from './generated/ast';
import { DomainModelServices } from './domain-model-module';

export class DomainModelValidationRegistry extends ValidationRegistry {
    constructor(services: DomainModelServices) {
        super(services);
        const validator = services.validation.DomainModelValidator;
        const checks: ValidationChecks<DomainModelAstType> = {
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
