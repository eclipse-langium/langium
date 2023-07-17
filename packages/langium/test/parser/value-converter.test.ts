/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from '../../src/index.js';
import type { TerminalRule } from '../../src/grammar/generated/ast.js';
import { describe, expect, test } from 'vitest';
import { createLangiumGrammarServices, EmptyFileSystem, GrammarAST } from '../../src/index.js';
import { parseHelper } from '../../src/test/index.js';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(grammarServices);

describe('DefaultValueConverter', () => {

    test('should process escaped characters', async () => {
        const doc = await parse(`
            terminal A: 'a\\'\\n\\t\\\\';
        `);
        const terminalA = doc.parseResult.value.rules[0] as TerminalRule;
        expect(terminalA).toBeDefined();
        expect(terminalA.definition.$type).toBe(GrammarAST.CharacterRange);
        expect((terminalA.definition as GrammarAST.CharacterRange).left.value).toBe('a\'\n\t\\');
    });

});
