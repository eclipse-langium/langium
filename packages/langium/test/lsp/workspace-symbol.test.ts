/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { createServicesForGrammar } from 'langium/grammar';
import { expectWorkspaceSymbols, parseHelper } from 'langium/test';

const grammar = `
 grammar HelloWorld
 entry Model: persons+=Person;
 Person: 'Person' name=ID;
 terminal ID: /\\w+/;
 hidden terminal WS: /\\s+/;
 `.trim();

describe('Workspace symbols', () => {

    test('Should show all workspace symbols', async () => {
        const helloWorldServices = await createServicesForGrammar({
            grammar
        });
        const symbols = expectWorkspaceSymbols(helloWorldServices.shared);
        const parser = parseHelper(helloWorldServices);
        await parser('Person Alice');
        await parser('Person Bob');
        await symbols({
            expectedSymbols: [
                'Alice',
                'Bob'
            ]
        });
    });

    test('Should show all workspace symbols matching the query', async () => {
        const helloWorldServices = await createServicesForGrammar({
            grammar
        });
        const symbols = expectWorkspaceSymbols(helloWorldServices.shared);
        const parser = parseHelper(helloWorldServices);
        await parser('Person Alice');
        await parser('Person Bob');
        await symbols({
            query: 'Ali',
            expectedSymbols: [
                'Alice'
            ]
        });
    });
});

