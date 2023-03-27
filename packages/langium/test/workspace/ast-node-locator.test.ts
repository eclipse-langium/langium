/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Alternatives, Grammar, ParserRule } from '../../src/grammar/generated/ast';
import { createLangiumGrammarServices, EmptyFileSystem } from '../../src';
import { parseHelper } from '../../src/test';

describe('DefaultAstNodeLocator', () => {
    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const parser = parseHelper<Grammar>(grammarServices);

    test('computes correct paths', async () => {
        const document = await parser(`
            grammar Foo
            entry A: B | C;
            B: 'b';
            C: 'c';
        `);
        const model = document.parseResult.value;
        const nodeLocator = grammarServices.workspace.AstNodeLocator;
        expect(nodeLocator.getAstNodePath(model.rules[0])).toBe('/rules@0');
        expect(nodeLocator.getAstNodePath((model.rules[0] as ParserRule).definition)).toBe('/rules@0/definition');
        expect(nodeLocator.getAstNodePath(((model.rules[0] as ParserRule).definition as Alternatives).elements[1])).toBe('/rules@0/definition/elements@1');
    });

    test('resolves paths correctly', async () => {
        const document = await parser(`
            grammar Foo
            entry A: B | C;
            B: 'b';
            C: 'c';
        `);
        const model = document.parseResult.value;
        const nodeLocator = grammarServices.workspace.AstNodeLocator;
        expect(nodeLocator.getAstNode(model, '/rules@0')).toBe(model.rules[0]);
        expect(nodeLocator.getAstNode(model, '/rules@0/definition')).toBe((model.rules[0] as ParserRule).definition);
        expect(nodeLocator.getAstNode(model, '/rules@0/definition/elements@1')).toBe(((model.rules[0] as ParserRule).definition as Alternatives).elements[1]);
    });

});
