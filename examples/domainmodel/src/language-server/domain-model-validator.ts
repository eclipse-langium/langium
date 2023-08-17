/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { DomainModelAstType, Type } from './generated/ast.js';
import type { DomainModelServices } from './domain-model-module.js';

export function registerValidationChecks(services: DomainModelServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.DomainModelValidator;
    const checks: ValidationChecks<DomainModelAstType> = {
        Type: validator.checkTypeStartsWithCapital
    };
    registry.register(checks, validator);
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
