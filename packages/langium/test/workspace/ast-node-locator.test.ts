/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, GrammarAST as GrammarTypes } from 'langium';
import { describe, expect, test } from 'vitest';
import { AstUtils, EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';

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
        expect(nodeLocator.getAstNodePath((model.rules[0] as GrammarTypes.ParserRule).definition)).toBe('/rules@0/definition');
        expect(nodeLocator.getAstNodePath(((model.rules[0] as GrammarTypes.ParserRule).definition as GrammarTypes.Alternatives).elements[1])).toBe('/rules@0/definition/elements@1');
    });

    test('computes the empty path for the root and paths that resolve back to every node', async () => {
        const document = await parser(`
            grammar Foo
            entry A: B | C;
            B: 'b' name=ID;
            C: 'c' (values+=STRING)*;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            terminal STRING: /"[^"]*"/;
        `);
        const model = document.parseResult.value;
        const nodeLocator = grammarServices.workspace.AstNodeLocator;
        expect(nodeLocator.getAstNodePath(model)).toBe('');
        let deepest = 0;
        for (const node of AstUtils.streamAllContents(model)) {
            const path = nodeLocator.getAstNodePath(node);
            expect(path.startsWith('/')).toBe(true);
            expect(nodeLocator.getAstNode(model, path)).toBe(node);
            deepest = Math.max(deepest, path.split('/').length - 1);
        }
        // the grammar must really nest, or the loop above proves little
        expect(deepest).toBeGreaterThanOrEqual(4);
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
        expect(nodeLocator.getAstNode(model, '/rules@0/definition')).toBe((model.rules[0] as GrammarTypes.ParserRule).definition);
        expect(nodeLocator.getAstNode(model, '/rules@0/definition/elements@1')).toBe(((model.rules[0] as GrammarTypes.ParserRule).definition as GrammarTypes.Alternatives).elements[1]);
    });

});
