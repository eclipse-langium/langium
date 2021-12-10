/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { expectFoldings } from '../../src/test';
import { expectFunction } from '../fixture';

const text = `
  grammar g hidden(hiddenTerminal)
  <|/**
   * Multiline
   * Comment|>
   */
  <|X: 
    name="X"
    value="Y";|>
  terminal hiddenTerminal: /x/;
  `;

const grammarServices = createLangiumGrammarServices().ServiceRegistry.all[0];
const foldings = expectFoldings(grammarServices, expectFunction);

describe('Folding range provider', () => {

    test('Should correctly provide a folding range for the X rule and multiline comment', async () => {
        await foldings({ text });
    });
});
