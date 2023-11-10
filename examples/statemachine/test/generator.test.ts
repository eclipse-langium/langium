/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { expandToStringWithNL, toString, type Generated } from 'langium/generate';
import { parseHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { generateCppContent } from '../src/cli/generator.js';
import type { Statemachine } from '../src/language-server/generated/ast.js';
import { createStatemachineServices } from '../src/language-server/statemachine-module.js';

describe('Tests the code generator', () => {
    const services = createStatemachineServices(EmptyFileSystem).statemachine;
    const parse = parseHelper<Statemachine>(services);

    test('Generation test', async () => {
        const ast = await parse(input);

        const generated: Generated = generateCppContent({
            statemachine: ast.parseResult.value,
            destination: undefined!, // not needed
            fileName: undefined!,    // not needed
        });

        const text = toString(generated);

        expect(text).toBe(expectedOutput);
    });
});

const input = expandToStringWithNL`
    statemachine TrafficLight

    events
        switchCapacity
        next

    initialState PowerOff

    state PowerOff
        switchCapacity => RedLight
    end

    state RedLight
        switchCapacity => PowerOff
        next => GreenLight
    end

    state YellowLight
        switchCapacity => PowerOff
        next => RedLight
    end

    state GreenLight
        switchCapacity => PowerOff
        next => YellowLight
    end
`;

const expectedOutput = expandToStringWithNL`
#include <iostream>
#include <map>
#include <string>

class TrafficLight;

class State {
protected:
    TrafficLight *statemachine;

public:
    virtual ~State() {}

    void set_context(TrafficLight *statemachine) {
        this->statemachine = statemachine;
    }

    virtual std::string get_name() {
        return "Unknown";
    }

    virtual void switchCapacity() {
        std::cout << "Impossible event for the current state." << std::endl;
    }

    virtual void next() {
        std::cout << "Impossible event for the current state." << std::endl;
    }
};


class TrafficLight {
private:
    State* state = nullptr;

public:
    TrafficLight(State* initial_state) {
        initial_state->set_context(this);
        state = initial_state;
        std::cout << "[" << state->get_name() << "]" << std::endl;
    }

    ~TrafficLight() {
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

    void switchCapacity() {
        state->switchCapacity();
    }

    void next() {
        state->next();
    }
};


class PowerOff : public State {
public:
    std::string get_name() override { return "PowerOff"; }
    void switchCapacity() override;
};

class RedLight : public State {
public:
    std::string get_name() override { return "RedLight"; }
    void switchCapacity() override;
    void next() override;
};

class YellowLight : public State {
public:
    std::string get_name() override { return "YellowLight"; }
    void switchCapacity() override;
    void next() override;
};

class GreenLight : public State {
public:
    std::string get_name() override { return "GreenLight"; }
    void switchCapacity() override;
    void next() override;
};

// PowerOff
void PowerOff::switchCapacity() {
    statemachine->transition_to(new RedLight);
}


// RedLight
void RedLight::switchCapacity() {
    statemachine->transition_to(new PowerOff);
}

void RedLight::next() {
    statemachine->transition_to(new GreenLight);
}


// YellowLight
void YellowLight::switchCapacity() {
    statemachine->transition_to(new PowerOff);
}

void YellowLight::next() {
    statemachine->transition_to(new RedLight);
}


// GreenLight
void GreenLight::switchCapacity() {
    statemachine->transition_to(new PowerOff);
}

void GreenLight::next() {
    statemachine->transition_to(new YellowLight);
}


typedef void (TrafficLight::*Event)();

int main() {
    TrafficLight *statemachine = new TrafficLight(new PowerOff);

    static std::map<std::string, Event> event_by_name;
    event_by_name["switchCapacity"] = &TrafficLight::switchCapacity;
    event_by_name["next"] = &TrafficLight::next;

    for (std::string input; std::getline(std::cin, input);) {
        std::map<std::string, Event>::const_iterator event_by_name_it = event_by_name.find(input);
        if (event_by_name_it == event_by_name.end()) {
            std::cout << "There is no event <" << input << "> in the TrafficLight statemachine." << std::endl;
            continue;
        }
        Event event_invoker = event_by_name_it->second;
        (statemachine->*event_invoker)();
    }

    delete statemachine;
    return 0;
}
`;
