/******************************************************************************
 * This file was generated by langium-cli 3.5.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable */
import * as langium from 'langium';

export const StatemachineTerminals = {
    WS: /\s+/,
    ID: /[_a-zA-Z][\w_]*/,
    ML_COMMENT: /\/\*[\s\S]*?\*\//,
    SL_COMMENT: /\/\/[^\n\r]*/,
};

export type StatemachineTerminalNames = keyof typeof StatemachineTerminals;

export type StatemachineKeywordNames =
    | "=>"
    | "actions"
    | "commands"
    | "end"
    | "events"
    | "initialState"
    | "state"
    | "statemachine"
    | "{"
    | "}";

export type StatemachineTokenNames = StatemachineTerminalNames | StatemachineKeywordNames;

export interface Command extends langium.AstNode {
    readonly $container: Statemachine;
    readonly $type: 'Command';
    name: string;
}

export const Command = 'Command';

export function isCommand(item: unknown): item is Command {
    return reflection.isInstance(item, Command);
}

/** An event is the trigger for a transition */
export interface Event extends langium.AstNode {
    readonly $container: Statemachine;
    readonly $type: 'Event';
    name: string;
}

export const Event = 'Event';

export function isEvent(item: unknown): item is Event {
    return reflection.isInstance(item, Event);
}

/** A description of the status of a system */
export interface State extends langium.AstNode {
    readonly $container: Statemachine;
    readonly $type: 'State';
    actions: Array<langium.Reference<Command>>;
    name: string;
    /** The transitions to other states that can take place from the current one */
    transitions: Array<Transition>;
}

export const State = 'State';

export function isState(item: unknown): item is State {
    return reflection.isInstance(item, State);
}

/** A textual represntation of a state machine */
export interface Statemachine extends langium.AstNode {
    readonly $type: 'Statemachine';
    commands: Array<Command>;
    /** The list of recognized event names */
    events: Array<Event>;
    /** The starting state for the machine */
    init: langium.Reference<State>;
    /** The name of the machine */
    name: string;
    /** Definitions of available states */
    states: Array<State>;
}

export const Statemachine = 'Statemachine';

export function isStatemachine(item: unknown): item is Statemachine {
    return reflection.isInstance(item, Statemachine);
}

/** A change from one state to another */
export interface Transition extends langium.AstNode {
    readonly $container: State;
    readonly $type: 'Transition';
    /** The event triggering the transition */
    event: langium.Reference<Event>;
    /** The target state */
    state: langium.Reference<State>;
}

export const Transition = 'Transition';

export function isTransition(item: unknown): item is Transition {
    return reflection.isInstance(item, Transition);
}

export type StatemachineAstType = {
    Command: Command
    Event: Event
    State: State
    Statemachine: Statemachine
    Transition: Transition
}

export class StatemachineAstReflection extends langium.AbstractAstReflection {

    getAllTypes(): string[] {
        return [Command, Event, State, Statemachine, Transition];
    }

    protected override computeIsSubtype(subtype: string, supertype: string): boolean {
        switch (subtype) {
            default: {
                return false;
            }
        }
    }

    getReferenceType(refInfo: langium.ReferenceInfo): string {
        const referenceId = `${refInfo.container.$type}:${refInfo.property}`;
        switch (referenceId) {
            case 'State:actions': {
                return Command;
            }
            case 'Statemachine:init':
            case 'Transition:state': {
                return State;
            }
            case 'Transition:event': {
                return Event;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }

    getTypeMetaData(type: string): langium.TypeMetaData {
        switch (type) {
            case Command: {
                return {
                    name: Command,
                    properties: [
                        { name: 'name' }
                    ]
                };
            }
            case Event: {
                return {
                    name: Event,
                    properties: [
                        { name: 'name' }
                    ]
                };
            }
            case State: {
                return {
                    name: State,
                    properties: [
                        { name: 'actions', defaultValue: [] },
                        { name: 'name' },
                        { name: 'transitions', defaultValue: [] }
                    ]
                };
            }
            case Statemachine: {
                return {
                    name: Statemachine,
                    properties: [
                        { name: 'commands', defaultValue: [] },
                        { name: 'events', defaultValue: [] },
                        { name: 'init' },
                        { name: 'name' },
                        { name: 'states', defaultValue: [] }
                    ]
                };
            }
            case Transition: {
                return {
                    name: Transition,
                    properties: [
                        { name: 'event' },
                        { name: 'state' }
                    ]
                };
            }
            default: {
                return {
                    name: type,
                    properties: []
                };
            }
        }
    }
}

export const reflection = new StatemachineAstReflection();
