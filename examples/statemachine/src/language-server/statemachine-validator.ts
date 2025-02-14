/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { State, Statemachine, StatemachineAstType, Event, Command, Transition } from './generated/ast.js';
import type { StatemachineServices } from './statemachine-module.js';
import { MultiMap, diagnosticData } from 'langium';

export namespace IssueCodes {
    export const StateNameUppercase = 'state-name-uppercase';
    export const UnreachedState = 'unreached-state';
    export const UnreachedCommand = 'unreached-command';
    export const UnreachedEvent = 'unreached-event';
}

export function registerValidationChecks(services: StatemachineServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.StatemachineValidator;
    const checks: ValidationChecks<StatemachineAstType> = {
        State: validator.checkStateNameStartsWithCapital,
        Statemachine: [
            validator.checkUniqueSymbolName,
            validator.checkUnreachedStates,
            validator.checkUnreachedCommands,
            validator.checkUnreachedEvents,
        ]
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
                accept('warning', 'State name should start with a capital letter.', {
                    node: state,
                    property: 'name',
                    data: diagnosticData(IssueCodes.StateNameUppercase),
                });
            }
        }
    }

    /**
     * Checks if there are duplicate command, event, and state names.
     * @param statemachine the statemachine to check
     * @param accept the acceptor to report errors
     */
    checkUniqueSymbolName(statemachine: Statemachine, accept: ValidationAcceptor): void {
        // check for duplicate state and event names and add them to the map
        const names = new MultiMap<string, Command | Event | State>();
        const allSymbols = [...statemachine.commands, ...statemachine.events, ...statemachine.states];
        for (const symbol of allSymbols) {
            names.add(symbol.name, symbol);
        }
        for (const [name, symbols] of names.entriesGroupedByKey()) {
            if (symbols.length > 1) {
                for (const symbol of symbols) {
                    accept('error', `Duplicate identifier name: ${name}`, { node: symbol, property: 'name' });
                }
            }
        }
    }

    /**
     * Checks for unreached states within the statemachine.
     * @param statemachine the statemachine to check
     * @param accept the acceptor to report errors
     */
    checkUnreachedStates(statemachine: Statemachine, accept: ValidationAcceptor): void {
        const states = new Map<string, State>();
        for (const state of statemachine.states) {
            states.set(state.name, state);
        }

        const { ref } = statemachine.init;
        if (ref && states.has(ref.name)) {
            states.delete(ref.name);
            this.removeStates(states, ref.transitions);
        }

        for (const [name, state] of states.entries()) {
            accept('hint', `Unreached state: ${name}`, {
                node: state,
                data: diagnosticData(IssueCodes.UnreachedState),
                tags: [1],
            });
        }
    }

    /**
     * Checks for unreached commands within the statemachine.
     * @param statemachine The statemachine to check.
     * @param acceptor The acceptor to report errors.
     */
    checkUnreachedCommands(statemachine: Statemachine, acceptor: ValidationAcceptor): void {
        const commandsByName = new Map<string, Command>();

        for (const command of statemachine.commands) {
            commandsByName.set(command.name, command);
        }

        for (const { actions } of statemachine.states) {
            for (const { ref } of actions) {
                if (ref && commandsByName.has(ref.name)) {
                    commandsByName.delete(ref.name);
                }
            }
        }

        for (const [name, command] of commandsByName.entries()) {
            acceptor('warning', `Unreached command: ${name}`, {
                node: command,
                property: 'name',
                data: diagnosticData(IssueCodes.UnreachedCommand),
                tags: [1],
            });
        }
    }

    /**
     * Checks for unreached evens within the statemachine.
     * @param statemachine the statemachine to check
     * @param accept the acceptor to report errors
     */
    checkUnreachedEvents(statemachine: Statemachine, acceptor: ValidationAcceptor): void {
        const eventsByName = new Map<string, Event>();

        for (const event of statemachine.events) {
            eventsByName.set(event.name, event);
        }

        for (const { transitions } of statemachine.states) {
            for (const { event: { ref: refEvent } } of transitions) {
                if (refEvent && eventsByName.has(refEvent.name)) {
                    eventsByName.delete(refEvent.name);
                }
            }
        }

        for (const [name, event] of eventsByName.entries()) {
            acceptor('warning', `Unreached event: ${name}`, {
                node: event,
                property: 'name',
                data: diagnosticData(IssueCodes.UnreachedEvent),
                tags: [1],
            });
        }
    }

    private removeStates(states: Map<string, State>, transitions: Transition[]): void {
        for (const { state: { ref } } of transitions) {
            if (ref && states.has(ref.name)) {
                states.delete(ref.name);
                this.removeStates(states, ref.transitions);
            }
        }
    }
}
