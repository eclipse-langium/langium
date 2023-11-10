/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Generated, expandToNode as toNode, joinToNode as join, toString } from 'langium/generate';
import type { State, Statemachine } from '../language-server/generated/ast.js';
import { extractDestinationAndName } from './cli-util.js';

// For precise white space handling in generation template
// we suggest you to enable the display of white space characters in your editor.
// In VS Code execute the 'Toggle Render Whitespace' command, for example.

export function generateCpp(statemachine: Statemachine, filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const ctx = <GeneratorContext>{
        statemachine,
        fileName: `${data.name}.cpp`,
        destination: data.destination,
    };
    return generate(ctx);
}

interface GeneratorContext {
    statemachine: Statemachine;
    fileName: string;
    destination: string;
}

function generate(ctx: GeneratorContext): string {
    const fileNode = generateCppContent(ctx);

    if (!fs.existsSync(ctx.destination)) {
        fs.mkdirSync(ctx.destination, { recursive: true });
    }

    const generatedFilePath = path.join(ctx.destination, ctx.fileName);
    fs.writeFileSync(generatedFilePath, toString(fileNode));
    return generatedFilePath;

}

function joinWithExtraNL<T>(content: T[], toString: (e: T) => Generated): Generated {
    return join(content, toString, { appendNewLineIfNotEmpty: true });
}

export function generateCppContent(ctx: GeneratorContext): Generated {
    return toNode`
        #include <iostream>
        #include <map>
        #include <string>

        class ${ctx.statemachine.name};

        ${generateStateClass(ctx)}


        ${generateStatemachineClass(ctx)}

        ${joinWithExtraNL(ctx.statemachine.states, state => generateStateDeclaration(ctx, state))}
        ${joinWithExtraNL(ctx.statemachine.states, state => generateStateDefinition(ctx, state))}

        typedef void (${ctx.statemachine.name}::*Event)();

        ${generateMain(ctx)}

    `;
}

function generateStateClass(ctx: GeneratorContext): Generated {
    return toNode`
        class State {
        protected:
            ${ctx.statemachine.name} *statemachine;

        public:
            virtual ~State() {}

            void set_context(${ctx.statemachine.name} *statemachine) {
                this->statemachine = statemachine;
            }

            virtual std::string get_name() {
                return "Unknown";
            }
        ${joinWithExtraNL(ctx.statemachine.events, event => toNode`
            
                virtual void ${event.name}() {
                    std::cout << "Impossible event for the current state." << std::endl;
                }
        `)}
        };
    `;
}

function generateStatemachineClass(ctx: GeneratorContext): Generated {
    return toNode`
        class ${ctx.statemachine.name} {
        private:
            State* state = nullptr;

        public:
            ${ctx.statemachine.name}(State* initial_state) {
                initial_state->set_context(this);
                state = initial_state;
                std::cout << "[" << state->get_name() << "]" << std::endl;
            }

            ~${ctx.statemachine.name}() {
                if (state != nullptr) {
                    delete state;
                }
            }

            void transition_to(State *new_state) {
                std::cout << state->get_name() << " ===> " << new_state->get_name() << std::endl;
                if (state != nullptr) {
                    delete state;
                }
                new_state->set_context(this);
                state = new_state;
            }
        ${joinWithExtraNL(ctx.statemachine.events, event => toNode`
            
                void ${event.name}() {
                    state->${event.name}();
                }
        `)}
        };
    `;
}

function generateStateDeclaration(ctx: GeneratorContext, state: State): Generated {
    return toNode`

        class ${state.name} : public State {
        public:
            std::string get_name() override { return "${state.name}"; }
            ${joinWithExtraNL(state.transitions, transition => `void ${transition.event.$refText}() override;`)}
        };
    `;
}

function generateStateDefinition(ctx: GeneratorContext, state: State): Generated {
    return toNode`

        // ${state.name}
        ${join(state.transitions, transition => toNode`
            void ${state.name}::${transition.event.$refText}() {
                statemachine->transition_to(new ${transition.state.$refText});
            }


        `)}
    `;
}

function generateMain(ctx: GeneratorContext): Generated {
    return toNode`
        int main() {
            ${ctx.statemachine.name} *statemachine = new ${ctx.statemachine.name}(new ${ctx.statemachine.init.$refText});

            static std::map<std::string, Event> event_by_name;
            ${joinWithExtraNL(ctx.statemachine.events, event => `event_by_name["${event.name}"] = &${ctx.statemachine.name}::${event.name};`)}

            for (std::string input; std::getline(std::cin, input);) {
                std::map<std::string, Event>::const_iterator event_by_name_it = event_by_name.find(input);
                if (event_by_name_it == event_by_name.end()) {
                    std::cout << "There is no event <" << input << "> in the ${ctx.statemachine.name} statemachine." << std::endl;
                    continue;
                }
                Event event_invoker = event_by_name_it->second;
                (statemachine->*event_invoker)();
            }

            delete statemachine;
            return 0;
        }
    `;
}
