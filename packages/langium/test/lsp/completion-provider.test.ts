/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices, createServicesForGrammar, EmptyFileSystem } from '../../src';
import { expectCompletion } from '../../src/test';

describe('Langium completion provider', () => {

    const text = `
    <|>gramm<|>ar g hid<|>den(hiddenTerminal)
    X: name="X";
    terminal hiddenTerminal: /x/;
    `;

    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const completion = expectCompletion(grammarServices);

    test('Should find starting rule', async () => {
        await completion({
            text,
            index: 0,
            expectedItems: [
                'grammar',
                // The grammar name element has become optional, so all other keywords are also included
                'import',
                'entry',
                'fragment',
                'hidden',
                'terminal',
                'interface',
                'type'
            ]
        });
    });

    test('Should find grammar keyword inside grammar keyword', async () => {
        await completion({
            text,
            index: 1,
            expectedItems: [
                'grammar'
            ]
        });
    });

    test('Should find hidden keyword', async () => {
        await completion({
            text,
            index: 2,
            expectedItems: [
                'hidden'
            ]
        });
    });

    test('Should perform case insensitive prefix matching', async () => {
        const model = `
        grammar g
        Aaaa: name="A";
        aaaa: name="a";
        Bbbb: name="B";
        C: a=aa<|>aa;`;
        // We expect 'Aaaa' and 'aaaa' but not 'Bbbb'
        await completion({
            text: model,
            index: 0,
            expectedItems: [
                'Aaaa',
                'aaaa'
            ]
        });
    });
});

describe('Completion within alternatives', () => {

    it('Should show correct keywords in completion of entry rule', async () => {

        const grammar = `
        grammar g
        entry Main: a?='a' 'b' 'c' | a?='a' 'b' 'd';
        hidden terminal WS: /\\s+/;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = '<|>a <|>b <|>c';

        await completion({
            text,
            index: 0,
            expectedItems: ['a']
        });
        await completion({
            text,
            index: 1,
            expectedItems: ['b']
        });
        await completion({
            text,
            index: 2,
            expectedItems: ['c', 'd']
        });
    });

    it('Should show correct cross reference and keyword in completion', async () => {

        const grammar = `
        grammar g
        entry Main: elements+=(Item | Ref)*;
        Item: 'item' name=ID;
        Ref: 'ref' (ref=[Item] | self?='self');
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = 'item A ref <|>A';

        await completion({
            text,
            index: 0,
            expectedItems: ['A', 'self']
        });
    });
});