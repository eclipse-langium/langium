/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import type { GrammarAST as GrammarTypes } from 'langium';
import { beforeEach, describe, expect, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { clearDocuments, parseHelper } from 'langium/test';
import { isSimpleType, isUnionType, SimpleType } from '../../../src/languages/generated/ast.js';

describe('Type Linking', () => {

    const services = createLangiumGrammarServices(EmptyFileSystem);
    const locator = services.grammar.workspace.AstNodeLocator;
    const parse = parseHelper<Grammar>(services.grammar);

    beforeEach(() => {
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
        const reference = locator.getAstNode<GrammarTypes.CrossReference>(grammar.parseResult.value, 'rules@2/definition/elements@1/terminal');
        const inferredType = locator.getAstNode<GrammarTypes.InferredType>(grammar.parseResult.value, 'rules@1/inferredType');
        expect(reference?.type.ref).toBe(inferredType);
    });

    test('Linking inferred in other file', async () => {
        const grammar1 = await parse(`
        A infers A:
            'A' a=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `, {
            documentUri: 'file:///inferred.langium'
        });
        const grammar2 = await parse(`
        grammar Debug
        import './inferred'
        entry Model:
            (b+=B | a+=A)*;
        B infers B:
            'B' b=[A:ID];
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar2, grammar1]);
        const reference = locator.getAstNode<GrammarTypes.CrossReference>(grammar2.parseResult.value, 'rules@1/definition/elements@1/terminal');
        const inferredType = locator.getAstNode<GrammarTypes.InferredType>(grammar1.parseResult.value, 'rules@0/inferredType');
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
        const reference = locator.getAstNode<GrammarTypes.CrossReference>(grammar.parseResult.value, 'rules@2/definition/elements@1/terminal');
        const declaredType = locator.getAstNode<GrammarTypes.Interface>(grammar.parseResult.value, 'interfaces@0');
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
        `, {
            documentUri: 'file:///declared.langium'
        });
        const grammar2 = await parse(`
        grammar Debug
        import './declared'
        interface B {
            b: @A
        }
        entry Model:
            (b+=B | a+=A)*;
        B returns B:
            'B' b=[A:ID];
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar2, grammar1]);
        const reference = locator.getAstNode<GrammarTypes.CrossReference>(grammar2.parseResult.value, 'rules@1/definition/elements@1/terminal');
        const declaredType = locator.getAstNode<GrammarTypes.Interface>(grammar1.parseResult.value, 'interfaces@0');
        expect(reference?.type.ref).toBe(declaredType);
    });

    test('Linking declared in transitively imported file', async () => {
        const grammar1 = await parse(`
        interface A {
            a: string
        }
        `, {
            documentUri: 'file:///declaredTransitive.langium'
        });
        const grammar2 = await parse(`
        import './declaredTransitive'
        A returns A:
            'A' a=ID;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        `, {
            documentUri: 'file:///declaredProxy.langium'
        });
        const grammar3 = await parse(`
        grammar Debug
        import './declaredProxy'
        interface B {
            b: @A
        }
        entry Model:
            (b+=B | a+=A)*;
        B returns B:
            'B' b=[A:ID];
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar3, grammar2, grammar1]);
        const reference = locator.getAstNode<GrammarTypes.CrossReference>(grammar3.parseResult.value, 'rules@1/definition/elements@1/terminal');
        const declaredType = locator.getAstNode<GrammarTypes.Interface>(grammar1.parseResult.value, 'interfaces@0');
        expect(reference?.type.ref).toBe(declaredType);
    });

    test.only('Linking types', async () => {
        const grammar = await parse(`
        interface A {
            a: string;
            joint: string;
        }
        interface B {
            b: string;
            joint: string;
        }
        // TODO warum ist das ein Interface und kein Type/Union??
        // TODO "Could not resolve reference to typeRef named 'A'."
        type C = A | B; // primitives sind unknown?!
        `);
        await services.shared.workspace.DocumentBuilder.build([grammar], { validation: true });
        const a = grammar.parseResult.value.interfaces[0];
        expect(a.name).toBe('A');
        const b = grammar.parseResult.value.interfaces[1];
        expect(b.name).toBe('B');
        const c = grammar.parseResult.value.types[0];
        expect(c.name).toBe('C');
        const cType = c.type;
        if (isUnionType(cType)) {
            expect(cType.types.length).toBe(2);
            expect(isSimpleType(cType.types[0])).toBeTruthy();
            expect((cType.types[0] as SimpleType).typeRef?.$refText).toBe('A');
            expect((cType.types[0] as SimpleType).typeRef?.ref).toBe(a);
            expect(isSimpleType(cType.types[1])).toBeTruthy();
            expect((cType.types[1] as SimpleType).typeRef?.$refText).toBe('AB');
            expect((cType.types[1] as SimpleType).typeRef?.ref).toBe(b);
        } else {
            expect.fail(`C has $type '${cType.$type}'.`);
        }
    });

});
