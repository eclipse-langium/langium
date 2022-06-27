/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../../src/node';
import { expectGoToDefinition } from '../../../src/test';
import { expectFunction } from '../../fixture';

/**
 * Represents a grammar file
 *
 * `index` <|> represents the position of the cursor where the GoTo Request is executed
 * `rangeIndex` <|ABC|> represent the range that should be targeted by a GoTo Request
 */
const text = `
grammar test hidden(WS, <|>COMMENT)

terminal ID: /\\w+/;
terminal WS: /\\s+/;
terminal <|COMMENT|>: /\\/\\/.*/;

Model: value=<|>Ent<|>ity;

<|Ent<|>ity|>: name=ID;

interface A {
    <|name|>:string
}

X returns A:
    <|>na<|>me=ID;
`.trim();

const grammarServices = createLangiumGrammarServices().grammar;
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

    test('Assignment name in parser rule X must find property name in interface A from start of location', async () => {
        await gotoDefinition({
            text,
            index: 4,
            rangeIndex: 2
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from within location', async () => {
        await gotoDefinition({
            text,
            index: 5,
            rangeIndex: 2
        });
    });
});
