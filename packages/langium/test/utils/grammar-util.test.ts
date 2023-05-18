/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from '../../src';
import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem, getAllReachableRules } from '../../src';
import { parseHelper } from '../../src/test';

const services = createLangiumGrammarServices(EmptyFileSystem);
const parse = parseHelper<Grammar>(services.grammar);

describe('Grammar Utils', () => {

    test('Terminal fragment rule should be reachable when only used by hidden terminal rule', async () => {
        // the actual bug was that the 'Ws' rule marked as unused - so a 'Error: Missing rule reference!' was thrown
        // arrange
        const input = `
            grammar HelloWorld

            entry Model: Hello;

            Hello: greeting='Hello!';

            hidden terminal COMMON__WS: Ws+;
            terminal fragment Ws: /[ \t\r\n\f]/;
        `;
        const output = await parse(input);

        // act
        const reachableRules = [...getAllReachableRules(output.parseResult.value, true)].map(r => r.name);

        // assert
        expect(reachableRules).toContain('Ws');
    });

    test('Parser rule should be reachable when only used in cross reference', async () => {
        // the actual bug was that the 'Hello' rule marked as unused - so
        // a 'Hint: This rule is declared but never referenced.' was thrown
        // arrange
        const input = `
            grammar HelloWorld

            entry Model: foreignHello=[Hello:NAME];

            Hello: greeting='Hello' name=NAME '!';

            terminal NAME: /[A-Z][a-z]*/;
        `;
        const output = await parse(input);

        // act
        const reachableRules = [...getAllReachableRules(output.parseResult.value, false)].map(r => r.name);

        // assert
        expect(reachableRules).toContain('Hello');
    });

});
