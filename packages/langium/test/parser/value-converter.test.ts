/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, GrammarAST as GrammarTypes } from 'langium';
import { describe, expect, test } from 'vitest';
import { EmptyFileSystem, GrammarAST } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(grammarServices);

describe('DefaultValueConverter', () => {

    test('should process escaped characters', async () => {
        const doc = await parse(`
            terminal A: 'a\\'\\n\\t\\\\';
        `);
        const terminalA = doc.parseResult.value.rules[0] as GrammarTypes.TerminalRule;
        expect(terminalA).toBeDefined();
        expect(terminalA.definition.$type).toBe(GrammarAST.CharacterRange);
        expect((terminalA.definition as GrammarAST.CharacterRange).left.value).toBe('a\'\n\t\\');
    });

});
