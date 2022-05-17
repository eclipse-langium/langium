/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { interpretAstReflection } from '../../src';

describe('AST reflection interpreter', () => {

    describe('Inheritance with sub- and super-types', () => {

        const reflectionForInheritance = interpretAstReflection({
            interfaces: [
                {
                    name: 'Super',
                    containerTypes: new Set(),
                    interfaceSuperTypes: [],
                    subTypes: new Set(['Sub']),
                    superTypes: new Set(),
                    properties: [{
                        name: 'A',
                        optional: false,
                        typeAlternatives: [{
                            array: true,
                            reference: false,
                            types: ['string']
                        }]
                    }]
                },
                {
                    name: 'Sub',
                    containerTypes: new Set(),
                    interfaceSuperTypes: ['Super'],
                    subTypes: new Set(),
                    superTypes: new Set(['Super']),
                    properties: [{
                        name: 'B',
                        optional: false,
                        typeAlternatives: [{
                            array: true,
                            reference: false,
                            types: ['string']
                        }]
                    }]
                }
            ],
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
