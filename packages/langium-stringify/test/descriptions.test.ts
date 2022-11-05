/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createServicesForGrammar } from 'langium';
import { getGrammarPropertyDescriptions, toValueDescriptionMap, ValueDescription } from '../src/descriptions';
import { matchDescriptions } from '../src/matching';
import { SerializationCache } from '../src/serialization-cache';

test('x', () => {

    const grammarText = `
    grammar X

    entry Rule: (name=ID | value="X");

    terminal ID: /\\^?[_a-zA-Z][\\w_]*/;

    hidden terminal WS: /\\s+/;
    `;

    const services = createServicesForGrammar({
        grammar: grammarText
    });

    const grammar = services.Grammar;
    const reflection = services.shared.AstReflection;
    const cache = new SerializationCache();
    const context = {
        cache, reflection
    };
    const rule = grammar.rules[0];
    const descriptions = getGrammarPropertyDescriptions(context, rule.definition);
    expect(descriptions).toBeDefined();

    const testValues: ValueDescription[] = [{
        property: 'value',
        value: 'X'
    }];
    const map = toValueDescriptionMap(testValues);
    const matches = matchDescriptions(context, map, descriptions!);
    expect(matches).toBeTruthy();
});