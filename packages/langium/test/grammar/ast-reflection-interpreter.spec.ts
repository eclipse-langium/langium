/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstReflection, createLangiumGrammarServices, Grammar, interpretAstReflection } from '../../src';
import { parseHelper } from '../../src/test';

describe('AST reflection interpreter', () => {

    describe('Inheritance with sub- and super-types', () => {

        let reflectionForInheritance: AstReflection;

        beforeAll(async () => {
            const grammarParser = parseHelper<Grammar>(createLangiumGrammarServices().grammar);
            const grammarDoc = await grammarParser(`
            interface Super {
                A: boolean
            }
            interface Sub extends Super {
                B: boolean
            }
            `);
            const grammar = grammarDoc.parseResult.value;

            reflectionForInheritance = interpretAstReflection(grammar);
        });

        test('isSubtype returns correct value', () => {
            expect(reflectionForInheritance.isSubtype('Sub', 'Super')).toBeTruthy();
            expect(reflectionForInheritance.isSubtype('Sub', 'Sub')).toBeTruthy();
            expect(reflectionForInheritance.isSubtype('Sub', 'SuperType')).toBeFalsy();
            expect(reflectionForInheritance.isSubtype('Super', 'Sub')).toBeFalsy();
        });

        test('getAllTypes returns "Sub", "Super"', () => {
            expect(reflectionForInheritance.getAllTypes()).toMatchObject(['Sub', 'Super']);
        });

        test('Creates metadata with super types', () => {
            const superMetadata = reflectionForInheritance.getTypeMetaData('Super');
            expect(superMetadata.mandatory).toHaveLength(1);
            expect(superMetadata.mandatory[0].name).toBe('A');
            const subMetadata = reflectionForInheritance.getTypeMetaData('Sub');
            expect(subMetadata.mandatory).toHaveLength(2);
            expect(subMetadata.mandatory[0].name).toBe('A');
            expect(subMetadata.mandatory[1].name).toBe('B');
        });

    });

});
