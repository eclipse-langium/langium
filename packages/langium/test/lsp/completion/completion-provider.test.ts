/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../../src';
import { expectCompletion } from '../../../src/test';
import { expectFunction } from '../../fixture';

const text = `
<|>gramm<|>ar g hid<|>den(hiddenTerminal)
X: name="X";
terminal hiddenTerminal: /x/;
`;

const grammarServices = createLangiumGrammarServices().ServiceRegistry.all[0];
const completion = expectCompletion(grammarServices, expectFunction);

describe('Completion Provider', () => {

    test('Finds starting rule', async () => {
        await completion({
            text,
            index: 0,
            expectedItems: ['grammar']
        });
    });

    test('Finds grammar keyword inside grammar keyword', async () => {
        await completion({
            text,
            index: 1,
            expectedItems: ['grammar']
        });
    });

    test('Finds hidden keyword', async () => {
        await completion({
            text,
            index: 2,
            expectedItems: ['hidden', '(']
        });
    });

    test('Does case insensitive prefix matching', async () => {
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
                'aaaa',
                '<',
                '?',
                '*',
                '+',
                '=>',
                '->',
                '(',
                '{',
                '&',
                '|',
                ';'
            ]
        });
    });
});
