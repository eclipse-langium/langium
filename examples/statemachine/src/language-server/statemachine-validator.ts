/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationCheck, ValidationRegistry } from 'langium';
import { State, StatemachineAstType } from './generated/ast';
import { StatemachineServices } from './statemachine-module';

type StatemachineChecks = { [type in StatemachineAstType]?: ValidationCheck | ValidationCheck[] }

export class StatemachineValidationRegistry extends ValidationRegistry {
    constructor(services: StatemachineServices) {
        super(services);
        const validator = services.validation.StatemachineValidator;
        const checks: StatemachineChecks = {
            State: validator.checkStateNameStartsWithCapital
        };
        this.register(checks, validator);
    }
}

export class StatemachineValidator {

    checkStateNameStartsWithCapital(state: State, accept: ValidationAcceptor): void {
        if (state.name) {
            const firstChar = state.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'State name should start with a capital letter.', { node: state, property: 'name' });
            }
        }
    }

}
