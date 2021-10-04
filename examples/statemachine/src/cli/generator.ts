/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import { CompositeGeneratorNode, NL, processGeneratorNode } from 'langium';
import { State, Statemachine } from '../language-server/generated/ast';
import { extractDestinationAndName } from './cli-util';
import path from 'path';

export function generateCpp(statemachine: Statemachine, filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const ctx = <GeneratorContext>{
        statemachine,
        fileName: `${data.name}.cpp`,
        destination: data.destination,
        fileNode: new CompositeGeneratorNode()
    };
    return generate(ctx);
}

interface GeneratorContext {
    statemachine: Statemachine;
    fileName: string;
    destination: string;
    fileNode: CompositeGeneratorNode
}

function generate(ctx: GeneratorContext): string {
    ctx.fileNode.append('#include <iostream>', NL);
    ctx.fileNode.append('#include <map>', NL);
    ctx.fileNode.append('#include <string>', NL, NL);

    ctx.fileNode.append(`class ${ctx.statemachine.name};`, NL, NL);

    generateStateClass(ctx);
    ctx.fileNode.append(NL, NL);

    generateStatemachineClass(ctx);
    ctx.fileNode.append(NL);

    ctx.statemachine.states.forEach(state => {
        ctx.fileNode.append(NL);
        generateStateDeclaration(ctx, state);
    });

    ctx.statemachine.states.forEach(state => {
        ctx.fileNode.append(NL);
        generateStateDefinition(ctx, state);
    });
    ctx.fileNode.append(NL);

    ctx.fileNode.append(`typedef void (${ctx.statemachine.name}::*Event)();`, NL, NL);

    generateMain(ctx);

    if (!fs.existsSync(ctx.destination)) {
        fs.mkdirSync(ctx.destination, { recursive: true });
    }
    const generatedFilePath = path.join(ctx.destination, ctx.fileName);
    fs.writeFileSync(generatedFilePath, processGeneratorNode(ctx.fileNode));
    return generatedFilePath;
}

function generateStateClass(ctx: GeneratorContext): void {
    ctx.fileNode.append('class State {', NL);
    ctx.fileNode.append('protected:', NL);
    ctx.fileNode.indent(classBodyProtected => {
        classBodyProtected.append(`${ctx.statemachine.name} *statemachine;`, NL);
    });
    ctx.fileNode.append(NL);

    ctx.fileNode.append('public:', NL);
    ctx.fileNode.indent(classBodyPublic => {
        classBodyPublic.append(`void set_context(${ctx.statemachine.name} *statemachine) {`, NL);
        classBodyPublic.indent(methodBody => {
            methodBody.append('this->statemachine = statemachine;', NL);
        });
        classBodyPublic.append('}', NL, NL);

        classBodyPublic.append('virtual std::string get_name() {', NL);
        classBodyPublic.indent(methodBody => {
            methodBody.append('return "Unknown";', NL);
        });
        classBodyPublic.append('}', NL);

        for (const event of ctx.statemachine.events) {
            classBodyPublic.append(NL);
            classBodyPublic.append(`virtual void ${event.name}() {`, NL);
            classBodyPublic.indent(methodBody => {
                methodBody.append('std::cout << "Impossible event for the current state." << std::endl;', NL);
            });
            classBodyPublic.append('}', NL);
        }
    });
    ctx.fileNode.append('};', NL);
}

function generateStatemachineClass(ctx: GeneratorContext) {
    ctx.fileNode.append(`class ${ctx.statemachine.name} {`, NL);
    ctx.fileNode.append('private:', NL);
    ctx.fileNode.indent(classBodyPrivate => {
        classBodyPrivate.append('State* state = nullptr;', NL);
    });
    ctx.fileNode.append(NL);

    ctx.fileNode.append('public:', NL);
    ctx.fileNode.indent(classBodyPublic => {
        classBodyPublic.append(`${ctx.statemachine.name}(State* initial_state) {`, NL);
        classBodyPublic.indent(ctorBody => {
            ctorBody.append('initial_state->set_context(this);', NL);
            ctorBody.append('state = initial_state;', NL);
            ctorBody.append('std::cout << "[" << state->get_name() << "]" << std::endl;', NL);
        });
        classBodyPublic.append('}', NL, NL);

        classBodyPublic.append(`~${ctx.statemachine.name}() {`, NL);
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

        for (const event of ctx.statemachine.events) {
            classBodyPublic.append(NL);
            classBodyPublic.append(`void ${event.name}() {`, NL);
            classBodyPublic.indent(methodBody => {
                methodBody.append(`state->${event.name}();`, NL);
            });
            classBodyPublic.append('}', NL);
        }
    });
    ctx.fileNode.append('};', NL);
}

function generateStateDeclaration(ctx: GeneratorContext, state: State) {
    ctx.fileNode.append(`class ${state.name} : public State {`, NL);
    ctx.fileNode.append('public:', NL);
    ctx.fileNode.indent(classBodyPublic => {
        classBodyPublic.append(`std::string get_name() override { return "${state.name}"; }`, NL);
        state.transitions.forEach(transition => classBodyPublic.append(`void ${transition.event.$refText}() override;`, NL));
    });
    ctx.fileNode.append('};', NL);
}

function generateStateDefinition(ctx: GeneratorContext, state: State) {
    ctx.fileNode.append(`// ${state.name}`, NL);
    for (const transition of state.transitions) {
        ctx.fileNode.append(`void ${state.name}::${transition.event.$refText}() {`, NL);
        ctx.fileNode.indent(transitionBody => {
            transitionBody.append(`statemachine->transition_to(new ${transition.state.$refText});`, NL);
        });
        ctx.fileNode.append('}', NL, NL);
    }
}

function generateMain(ctx: GeneratorContext) {
    ctx.fileNode.append('int main() {', NL);
    ctx.fileNode.indent(mainBody => {
        mainBody.append(`${ctx.statemachine.name} *statemachine = new ${ctx.statemachine.name}(new ${ctx.statemachine.init.$refText});`, NL, NL);

        mainBody.append('static std::map<std::string, Event> event_by_name;', NL);
        for (const event of ctx.statemachine.events) {
            mainBody.append(`event_by_name["${event.name}"] = &${ctx.statemachine.name}::${event.name};`, NL);
        }
        mainBody.append(NL);

        mainBody.append('for (std::string input; std::getline(std::cin, input);) {', NL);
        mainBody.indent(forBody => {
            forBody.append('std::map<std::string, Event>::const_iterator event_by_name_it = event_by_name.find(input);', NL);
            forBody.append('if (event_by_name_it == event_by_name.end()) {', NL);
            forBody.indent(thenBody => {
                thenBody.append(`std::cout << "There is no event <" << input << "> in the ${ctx.statemachine.name} statemachine." << std::endl;`, NL);
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
    ctx.fileNode.append('}', NL);
}