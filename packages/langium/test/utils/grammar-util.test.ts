/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from '../../src';
import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem, getAllReachableRules } from '../../src';
import { parseHelper } from '../../src/test';
import { Utils } from 'vscode-uri';

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

    test('getAllReachableRules should return rules referenced in cross references', async () => {
        // [A] is short for [A:ID] thus the ID rule is needed by the parser and getAllReachableRules should return ID
        const grammar1 = await parse(`
        grammar G1
        entry A:
            'A' name=ID;
        Uncalled: name=IDX;
        Called: name=INT;
        terminal INT returns number: /[0-9]+/;    
        terminal ID: /[A-Z][\\w_]*/;
        terminal IDX: /[a-z][\\w_]*/;
        `);
        const grammar2 = await parse(`
        grammar G2
        import './${Utils.basename(grammar1.uri)}'
        entry B: ref=[A] s=STRING c=Called;
        terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar2, grammar1]);
        // act
        const reachableRules = [...getAllReachableRules(grammar2.parseResult.value, true)].map(r => r.name);
        // assert
        expect(reachableRules).toEqual(['B', 'STRING', 'ID', 'Called', 'INT' ]);
    });

    test('getAllReachableRules should not return unused rules', async () => {
        // no implicit ID rule call in cross ref
        // [A] is short for [A:ID] thus the ID rule is needed by the parser and getAllReachableRules should return ID
        const grammar1 = await parse(`
        grammar G1
        entry A:
        'A' name=ID;
        Other: name=STRING;
        terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        const grammar2 = await parse(`
        grammar G2
        import './${Utils.basename(grammar1.uri)}'
        entry B: ref=[A];
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar2, grammar1]);
        // act
        const reachableRules = [...getAllReachableRules(grammar2.parseResult.value, true)].map(r => r.name);

        // assert
        expect(reachableRules).not.toContain('STRING');
    });

});
