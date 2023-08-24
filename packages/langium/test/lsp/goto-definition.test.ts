/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectGoToDefinition } from 'langium/test';

/**
 * Represents a grammar file
 *
 * `index` <|> represents the position of the cursor where the GoTo Request is executed
 * `rangeIndex` <|ABC|> represent the range that should be targeted by a GoTo Request
 */
const text = `
grammar test hidden(WS, <|>COMMENT)

term<|>inal ID: /\\w+/;
terminal WS: /\\s+/;
terminal <|COMMENT|>: /\\/\\/.*/;

Model: value=<|>Ent<|>ity;

<|Ent<|>ity|>: name=ID;

interface A {
    <|name|>:string
}

X retu<|>rns A:
    <|>na<|>me<|>=ID; <|>
`.trim();

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const gotoDefinition = expectGoToDefinition(grammarServices);

describe('Definition Provider', () => {

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
            index: 2,
            rangeIndex: 1
        });
    });

    test('Entity must find itself when referenced from within other location', async () => {
        await gotoDefinition({
            text,
            index: 3,
            rangeIndex: 1
        });
    });

    test('Entity must find itself when referenced from source location', async () => {
        await gotoDefinition({
            text,
            index: 4,
            rangeIndex: 1
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from start of location', async () => {
        await gotoDefinition({
            text,
            index: 6,
            rangeIndex: 2
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from within location', async () => {
        await gotoDefinition({
            text,
            index: 7,
            rangeIndex: 2
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from end of location', async () => {
        await gotoDefinition({
            text,
            index: 8,
            rangeIndex: 2
        });
    });

    describe('Should not find anything on certain cst nodes', () => {

        test('Should find nothing on `terminal` keyword', async () => {
            await gotoDefinition({
                text,
                index: 1,
                rangeIndex: []
            });
        });

        test('Should find nothing on `returns` keyword', async () => {
            await gotoDefinition({
                text,
                index: 5,
                rangeIndex: []
            });
        });

        test('Should find nothing white space', async () => {
            await gotoDefinition({
                text,
                index: 9,
                rangeIndex: []
            });
        });
    });
});
