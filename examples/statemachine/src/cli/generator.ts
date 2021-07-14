/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'fs';
import { CompositeGeneratorNode, NL, processGeneratorNode } from 'langium';
import { State, Statemachine } from '../language-server/generated/ast';

export class StatemachineGenerator {
    private statemachine: Statemachine;
    private fileName: string;
    private destination: string;
    private fileNode: CompositeGeneratorNode = new CompositeGeneratorNode();

    constructor(statemachine: Statemachine, fileName: string, destination: string | undefined) {
        this.statemachine = statemachine;

        const fileNameSeq = fileName.replace(/\..*$/, '').replaceAll(/[.-]/g, '').split('/');
        this.fileName = `${fileNameSeq.pop() ?? 'statemachine'}.cpp`;
        if (destination) {
            this.destination = destination;
        } else {
            this.destination = `./${fileNameSeq.join('/')}/generated`;
        }
    }

    public generate(): void {
        this.fileNode.append('#include <iostream>', NL);
        this.fileNode.append('#include <map>', NL);
        this.fileNode.append('#include <string>', NL, NL);

        this.fileNode.append(`class ${this.statemachine.name};`, NL, NL);

        this.generateStateClass();
        this.fileNode.append(NL, NL);

        this.generateStatemachineClass();
        this.fileNode.append(NL);

        this.statemachine.states.forEach(state => {
            this.fileNode.append(NL);
            this.generateStateDeclaration(state);
        });

        this.statemachine.states.forEach(state => {
            this.fileNode.append(NL);
            this.generateStateDefinition(state);
        });
        this.fileNode.append(NL);

        this.fileNode.append(`typedef void (${this.statemachine.name}::*Event)();`, NL, NL);

        this.generateMain();

        if (!fs.existsSync(this.destination)) {
            fs.mkdirSync(this.destination, { recursive: true });
        }
        fs.writeFileSync(`${this.destination}/${this.fileName}`, processGeneratorNode(this.fileNode));
    }

    private generateStateClass(): void {
        this.fileNode.append('class State {', NL);
        this.fileNode.append('protected:', NL);
        this.fileNode.indent(classBodyProtected => {
            classBodyProtected.append(`${this.statemachine.name} *statemachine;`, NL);
        });
        this.fileNode.append(NL);

        this.fileNode.append('public:', NL);
        this.fileNode.indent(classBodyPublic => {
            classBodyPublic.append(`void set_context(${this.statemachine.name} *statemachine) {`, NL);
            classBodyPublic.indent(methodBody => {
                methodBody.append('this->statemachine = statemachine;', NL);
            });
            classBodyPublic.append('}', NL, NL);

            classBodyPublic.append('virtual std::string get_name() {', NL);
            classBodyPublic.indent(methodBody => {
                methodBody.append('return "Unknown";', NL);
            });
            classBodyPublic.append('}', NL);

            for (const event of this.statemachine.events) {
                classBodyPublic.append(NL);
                classBodyPublic.append(`virtual void ${event.name}() {`, NL);
                classBodyPublic.indent(methodBody => {
                    methodBody.append('std::cout << "Impossible event for the current state." << std::endl;', NL);
                });
                classBodyPublic.append('}', NL);
            }
        });
        this.fileNode.append('};', NL);
    }

    private generateStatemachineClass() {
        this.fileNode.append(`class ${this.statemachine.name} {`, NL);
        this.fileNode.append('private:', NL);
        this.fileNode.indent(classBodyPrivate => {
            classBodyPrivate.append('State* state = nullptr;', NL);
        });
        this.fileNode.append(NL);

        this.fileNode.append('public:', NL);
        this.fileNode.indent(classBodyPublic => {
            classBodyPublic.append(`${this.statemachine.name}(State* initial_state) {`, NL);
            classBodyPublic.indent(ctorBody => {
                ctorBody.append('initial_state->set_context(this);', NL);
                ctorBody.append('state = initial_state;', NL);
                ctorBody.append('std::cout << "[" << state->get_name() << "]" << std::endl;', NL);
            });
            classBodyPublic.append('}', NL, NL);

            classBodyPublic.append(`~${this.statemachine.name}() {`, NL);
            classBodyPublic.indent(dctorBody => {
                dctorBody.append('if (state != nullptr) {', NL);
                dctorBody.indent(thenBody => {
                    thenBody.append('delete state;', NL);
                });
                dctorBody.append('}', NL);
            });
            classBodyPublic.append('}', NL, NL);

            classBodyPublic.append('void transition_to(State *new_state) {', NL);
            classBodyPublic.indent(methodBody => {
                methodBody.append('std::cout << state->get_name() << " ===> " << new_state->get_name() << std::endl;', NL);
                methodBody.append('if (state != nullptr) {', NL);
                methodBody.indent(thenBody => {
                    thenBody.append('delete state;', NL);
                });
                methodBody.append('}', NL);

                methodBody.append('new_state->set_context(this);', NL);

                methodBody.append('state = new_state;', NL);

            });
            classBodyPublic.append('}', NL);

            for (const event of this.statemachine.events) {
                classBodyPublic.append(NL);
                classBodyPublic.append(`void ${event.name}() {`, NL);
                classBodyPublic.indent(methodBody => {
                    methodBody.append(`state->${event.name}();`, NL);
                });
                classBodyPublic.append('}', NL);
            }
        });
        this.fileNode.append('};', NL);
    }

    private generateStateDeclaration(state: State) {
        this.fileNode.append(`class ${state.name} : public State {`, NL);
        this.fileNode.append('public:', NL);
        this.fileNode.indent(classBodyPublic => {
            classBodyPublic.append(`std::string get_name() override { return "${state.name}"; }`, NL);
            state.transitions.forEach(transition => classBodyPublic.append(`void ${transition.event.$refName}() override;`, NL));
        });
        this.fileNode.append('};', NL);
    }

    private generateStateDefinition(state: State) {
        this.fileNode.append(`// ${state.name}`, NL);
        for (const transition of state.transitions) {
            this.fileNode.append(`void ${state.name}::${transition.event.$refName}() {`, NL);
            this.fileNode.indent(transitionBody => {
                transitionBody.append(`statemachine->transition_to(new ${transition.state.$refName});`, NL);
            });
            this.fileNode.append('}', NL, NL);
        }
    }

    private generateMain() {
        this.fileNode.append('int main() {', NL);
        this.fileNode.indent(mainBody => {
            mainBody.append(`${this.statemachine.name} *statemachine = new ${this.statemachine.name}(new ${this.statemachine.init.$refName});`, NL, NL);

            mainBody.append('static std::map<std::string, Event> event_by_name;', NL);
            for (const event of this.statemachine.events) {
                mainBody.append(`event_by_name["${event.name}"] = &${this.statemachine.name}::${event.name};`, NL);
            }
            mainBody.append(NL);

            mainBody.append('for (std::string input; std::getline(std::cin, input);) {', NL);
            mainBody.indent(forBody => {
                forBody.append('std::map<std::string, Event>::const_iterator event_by_name_it = event_by_name.find(input);', NL);
                forBody.append('if (event_by_name_it == event_by_name.end()) {', NL);
                forBody.indent(thenBody => {
                    thenBody.append(`std::cout << "There is no event <" << input << "> in the ${this.statemachine.name} statemachine." << std::endl;`, NL);
                    thenBody.append('continue;', NL);
                });
                forBody.append('}', NL);
                forBody.append('Event event_invoker = event_by_name_it->second;', NL);
                forBody.append('(statemachine->*event_invoker)();', NL);
            });
            mainBody.append('}', NL, NL);

            mainBody.append('delete statemachine;', NL);
            mainBody.append('return 0;', NL);
        });
        this.fileNode.append('}', NL);
    }

}
