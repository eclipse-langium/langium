/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks } from 'langium';
import { State, Statemachine, StatemachineAstType, Event } from './generated/ast';
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
        // check for duplicate state and event names and add them to the map
        const names = new Map<string, State | Event | undefined>();
        for (const state of statemachine.states) {
            if (names.has(state.name)) {
                const duplicate = names.get(state.name);
                if (duplicate) {
                    accept('error', `Duplicate state name: ${state.name}`, { node: duplicate as State, property: 'name' });
                }
                accept('error', `Duplicate state name: ${state.name}`, { node: state, property: 'name' });
            } else {
                names.set(state.name, state);
            }
        }
        for (const event of statemachine.events) {
            if (names.has(event.name)) {
                const duplicate = names.get(event.name);
                if (duplicate) {
                    accept('error', `Duplicate event name: ${event.name}`, { node: duplicate as Event, property: 'name' });
                }
                accept('error', `Duplicate event name: ${event.name}`, { node: event, property: 'name' });
            } else {
                names.set(event.name, event);
            }
        }
    }
}
