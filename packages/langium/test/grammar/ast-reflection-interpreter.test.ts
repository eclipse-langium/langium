/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { interpretAstReflection } from '../../src';
import { InterfaceType } from '../../src/grammar/type-system/type-collector/types';

describe('AST reflection interpreter', () => {

    describe('Inheritance with sub- and super-types', () => {

        const superType = new InterfaceType('Super', [], [
            {
                name: 'A',
                optional: false,
                typeAlternatives: [{
                    array: true,
                    reference: false,
                    types: ['string']
                }],
                astNodes: new Set()
            },
            {
                name: 'Ref',
                optional: true,
                typeAlternatives: [{
                    array: false,
                    reference: true,
                    types: ['RefTarget']
                }],
                astNodes: new Set()
            }
        ]);

        const subType = new InterfaceType('Sub', ['Super'], [
            {
                name: 'B',
                optional: false,
                typeAlternatives: [{
                    array: true,
                    reference: false,
                    types: ['string']
                }],
                astNodes: new Set()
            }
        ]);

        const reflectionForInheritance = interpretAstReflection({
            interfaces: [superType, subType],
            unions: []
        });

        test('isSubtype returns correct value', () => {
            expect(reflectionForInheritance.isSubtype('Sub', 'Super')).toBeTruthy();
            expect(reflectionForInheritance.isSubtype('Sub', 'Sub')).toBeTruthy();
            expect(reflectionForInheritance.isSubtype('Sub', 'SuperType')).toBeFalsy();
            expect(reflectionForInheritance.isSubtype('Super', 'Sub')).toBeFalsy();
        });

        test('getAllTypes returns "Super", "Sub"', () => {
            expect(reflectionForInheritance.getAllTypes()).toMatchObject(['Super', 'Sub']);
        });

        test('Creates reference types with super types in mind', () => {
            expect(reflectionForInheritance.getReferenceType({
                container: {
                    $type: 'Super'
                },
                property: 'Ref',
                reference: undefined!
            })).toBe('RefTarget');
            expect(reflectionForInheritance.getReferenceType({
                container: {
                    $type: 'Sub'
                },
                property: 'Ref',
                reference: undefined!
            })).toBe('RefTarget');
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
