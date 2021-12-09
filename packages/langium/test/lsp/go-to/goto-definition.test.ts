/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../../src';
import { expectGoToDefinition } from '../../../src/test';
import { expectFunction } from '../../fixture';

const text = `
grammar test hidden(WS, <|>COMMENT)

terminal ID: /\\w+/;
terminal WS: /\\s+/;
terminal <|COMMENT|>: /\\/\\/.*/;

Model: value=<|>Ent<|>ity;

<|Ent<|>ity|>: name=ID;
`.trim();

const grammarServices = createLangiumGrammarServices().ServiceRegistry.all[0];
const gotoDefinition = expectGoToDefinition(grammarServices, expectFunction);

describe('GoToResolver', () => {

    test('Must find SL_COMMENT inside of array of cross references', async () => {
        await gotoDefinition({
            text,
            index: 0,
            rangeIndex: 0
        });
    });

    test('Entity must find itself when referenced from start of other location', async () => {
        await gotoDefinition({
            text,
            index: 1,
            rangeIndex: 1
        });
    });

    test('Entity must find itself when referenced from within other location', async () => {
        await gotoDefinition({
            text,
            index: 2,
            rangeIndex: 1
        });
    });

    test('Entity must find itself when referenced from source location', async () => {
        await gotoDefinition({
            text,
            index: 3,
            rangeIndex: 1
        });
    });
});
