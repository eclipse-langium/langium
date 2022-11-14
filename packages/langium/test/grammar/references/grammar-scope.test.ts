/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Utils } from 'vscode-uri';
import { createLangiumGrammarServices, EmptyFileSystem, Grammar } from '../../../src';
import { CrossReference, InferredType, Interface } from '../../../src/grammar/generated/ast';
import { clearDocuments, parseHelper } from '../../../src/test';

describe('Type Linking', () => {

    const services = createLangiumGrammarServices(EmptyFileSystem);
    const locator = services.grammar.workspace.AstNodeLocator;
    const parse = parseHelper<Grammar>(services.grammar);

    beforeAll(() => {
        clearDocuments(services.grammar);
    });

    test('Linking inferred in same file', async () => {
        const grammar = await parse(`
        grammar Debug
        entry Model:
            (b+=B | a+=A)*;
        A infers A:
            'A' a=ID;
        B infers B:
            'B' b=[A:ID];
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar]);
        const reference = locator.getAstNode<CrossReference>(grammar, 'rules@2/definition/elements@1/terminal');
        const inferredType = locator.getAstNode<InferredType>(grammar, 'rules@1/inferredType');
        expect(reference?.type.ref).toBe(inferredType);
    });

    test('Linking inferred in other file', async () => {
        const grammar1 = await parse(`
        A infers A:
            'A' a=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        const grammar2 = await parse(`
        grammar Debug
        import './${Utils.basename(grammar1.uri)}'
        entry Model:
            (b+=B | a+=A)*;
        B infers B:
            'B' b=[A:ID];
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar2, grammar1]);
        const reference = locator.getAstNode<CrossReference>(grammar2, 'rules@1/definition/elements@1/terminal');
        const inferredType = locator.getAstNode<InferredType>(grammar1, 'rules@0/inferredType');
        expect(reference?.type.ref).toBe(inferredType);
    });

    test('Linking declared in same file', async () => {
        const grammar = await parse(`
        grammar Debug
        interface A {
            a: string
        }
        interface B {
            b: @A
        }
        entry Model:
            (b+=B | a+=A)*;
        A returns A:
            'A' a=ID;
        B returns B:
            'B' b=[A:ID];
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar]);
        const reference = locator.getAstNode<CrossReference>(grammar, 'rules@2/definition/elements@1/terminal');
        const declaredType = locator.getAstNode<Interface>(grammar, 'interfaces@0');
        expect(reference?.type.ref).toBe(declaredType);
    });

    test('Linking declared in other file', async () => {
        const grammar1 = await parse(`
        interface A {
            a: string
        }
        A returns A:
            'A' a=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `);
        const grammar2 = await parse(`
        grammar Debug
        import './${Utils.basename(grammar1.uri)}'
        interface B {
            b: @A
        }
        entry Model:
            (b+=B | a+=A)*;
        B returns B:
            'B' b=[A:ID];
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar2, grammar1]);
        const reference = locator.getAstNode<CrossReference>(grammar2, 'rules@1/definition/elements@1/terminal');
        const declaredType = locator.getAstNode<Interface>(grammar1, 'interfaces@0');
        expect(reference?.type.ref).toBe(declaredType);
    });

});
