/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { beforeAll, describe, test } from 'vitest';
import type { AsyncDisposable} from 'langium';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import type { ExpectedHover} from 'langium/test';
import { expectHover } from 'langium/test';

describe('Hover', () => {
    const text = `
  /**
   * I am a grammar file comment
   */
  // This is just a single line comment
  /**
   * Hi I am a grammar JSDoc comment
   */
  // Another single line comment
  grammar <|>g  <|> 
  /**
   * Hi I am Rule 'X'
   */
  <|>X: name="X";
  /**
   * Hi I reference Rule {@linkcode X}
   */
  <|>Y: value=<|>X;
    `;

    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const hover = expectHover(grammarServices);

    test('Hovering over whitespace should not provide a hover', async () => {
        await hover({
            text,
            index: 1,
            hover: undefined
        });
    });

    test('Hovering over the root node should also provide the documentation', async () => {
        await hover({
            text,
            index: 0,
            hover: 'Hi I am a grammar JSDoc comment'
        });
    });

    test('Hovering over X definition shows the comment hovering', async () => {
        await hover({
            text,
            index: 2,
            hover: "Hi I am Rule 'X'"
        });
    });

    test('Hovering over X definition shows the comment hovering', async () => {
        await hover({
            text,
            index: 4,
            hover: "Hi I am Rule 'X'"
        });
    });

    test('Hovering over Y renders the link as a vscode uri link', async () => {
        await hover({
            text,
            index: 3,
            hover: /Hi I reference Rule \[`X`\]\(file:\/\/\/\w*\.langium#L14%2C3\)/
        });
    });
});

describe('Hover on keywords', () => {

    const grammar = `grammar HoverOnKeywords

    entry Model:
        /** root keyword */ 'root' name=ID
        elements+=Tag*;

    Tag: /** opening tag */ 'tag' name=ID /** closing tag */ 'tag';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
    hidden terminal ML_COMMENT: /#\\*[\\s\\S]*?\\*#/;
    hidden terminal SL_COMMENT: /##[^\\n\\r]*/;
    `;

    const text = `
    ## SL_COMMENT
    <|>root name
    #* ML_COMMENT *#
    <|>tag first <|>tag
      `;

    let hover: (expectedHover: ExpectedHover) => Promise<AsyncDisposable>;

    beforeAll(async () => {
        const services = await createServicesForGrammar({
            grammar
        });
        hover = expectHover(services);
    });
    test('Hovering over root keyword', async () => {
        await hover({
            text,
            index: 0,
            hover: 'root keyword'
        });
    });
    test('Hovering over opening tag keyword', async () => {

        await hover({
            text,
            index: 1,
            hover: 'opening tag'
        });
    });
    test('Hovering over closing tag keyword', async () => {
        await hover({
            text,
            index: 2,
            hover: 'closing tag'
        });
    });
});
