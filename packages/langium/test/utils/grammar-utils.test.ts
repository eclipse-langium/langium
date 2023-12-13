/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import { describe, expect, test } from 'vitest';
import { EmptyFileSystem, GrammarUtils } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';

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
        const reachableRules = [...GrammarUtils.getAllReachableRules(output.parseResult.value, true)].map(r => r.name);

        // assert
        expect(reachableRules).toContain('Ws');
    });

});
