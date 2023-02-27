/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks } from 'langium';
import { State, Statemachine, StatemachineAstType } from './generated/ast';
import type { StatemachineServices } from './statemachine-module';

export function registerValidationChecks(services: StatemachineServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.StatemachineValidator;
    const checks: ValidationChecks<StatemachineAstType> = {
        State: validator.checkStateNameStartsWithCapital,
        Statemachine: validator.checkUniqueStatesAndEvents
    };
    registry.register(checks, validator);
}

export class StatemachineValidator {
    /**
     * Checks if the state name starts with a capital letter.
     * @param state the state to check
     * @param accept the acceptor to report errors
     */
    checkStateNameStartsWithCapital(state: State, accept: ValidationAcceptor): void {
        if (state.name) {
            const firstChar = state.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'State name should start with a capital letter.', { node: state, property: 'name' });
            }
        }
    }
    /**
     * Checks if there are duplicate state and event names.
     * @param statemachine the statemachine to check
     * @param accept the acceptor to report errors
     */
    checkUniqueStatesAndEvents(statemachine: Statemachine, accept: ValidationAcceptor): void {
        const variables: string[] = [];

        // let's check for duplicate state names
        statemachine.states.forEach(state => {
            if (variables.find(name => name === state.name)) {
                accept('error',  `Name '${state.name}' does already exist.`, {node: state, property: 'name'});
            }
            variables.push(state.name);
        });

        // let's check for duplicate event names
        statemachine.events.forEach(event => {
            if (variables.find(name => name === event.name)) {
                accept('error',  `Name '${event.name}' does already exist.`, {node: event, property: 'name'});
            }
            variables.push(event.name);
        });
    }

}
