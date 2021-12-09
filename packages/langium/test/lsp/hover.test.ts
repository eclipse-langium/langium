/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { expectHover } from '../../src/test';
import { expectFunction } from '../fixture';

const text = `
  grammar g
  /**
   * Hi I am Rule 'X'
   */
  <|>X: name="X";
  Y: value=<|>X;
  `;

const grammarServices = createLangiumGrammarServices().ServiceRegistry.all[0];
const hover = expectHover(grammarServices, expectFunction);

describe('Hover', () => {

    test('Hovering over X definition shows the comment hovering', async () => {
        await hover({
            text,
            index: 0,
            hover: "Hi I am Rule 'X'"
        });
    });

    test('Hovering over X reference shows the comment hovering', async () => {
        await hover({
            text,
            index: 1,
            hover: "Hi I am Rule 'X'"
        });
    });
});
