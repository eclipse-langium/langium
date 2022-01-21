/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Alternatives, Grammar, ParserRule } from '../../src/grammar/generated/ast';
import { createLangiumGrammarServices } from '../../src/grammar/langium-grammar-module';
import { parseHelper } from '../../src/test';

describe('DefaultAstNodeLocator', () => {
    const grammarServices = createLangiumGrammarServices().grammar;
    const parser = parseHelper<Grammar>(grammarServices);

    test('computes correct paths', async () => {
        const document = await parser(`
            grammar Foo
            entry A: B | C;
            B: 'b';
            C: 'c';
        `);
        const model = document.parseResult.value;
        const nodeLocator = grammarServices.index.AstNodeLocator;
        expect(nodeLocator.getAstNodePath(model.rules[0])).toBe('/rules@0');
        expect(nodeLocator.getAstNodePath((model.rules[0] as ParserRule).alternatives)).toBe('/rules@0/alternatives');
        expect(nodeLocator.getAstNodePath(((model.rules[0] as ParserRule).alternatives as Alternatives).elements[1])).toBe('/rules@0/alternatives/elements@1');
    });

    test('resolves paths correctly', async () => {
        const document = await parser(`
            grammar Foo
            entry A: B | C;
            B: 'b';
            C: 'c';
        `);
        const model = document.parseResult.value;
        const nodeLocator = grammarServices.index.AstNodeLocator;
        expect(nodeLocator.getAstNode(document, '/rules@0')).toBe(model.rules[0]);
        expect(nodeLocator.getAstNode(document, '/rules@0/alternatives')).toBe((model.rules[0] as ParserRule).alternatives);
        expect(nodeLocator.getAstNode(document, '/rules@0/alternatives/elements@1')).toBe(((model.rules[0] as ParserRule).alternatives as Alternatives).elements[1]);
    });

});
