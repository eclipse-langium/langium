/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectFoldings } from 'langium/test';

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

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const foldings = expectFoldings(grammarServices);

describe('Folding range provider', () => {

    test('Should correctly provide a folding range for the X rule and multiline comment', async () => {
        await foldings({ text });
    });
});
