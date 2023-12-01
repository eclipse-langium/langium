/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { InterfaceType, interpretAstReflection } from 'langium/grammar';

describe('AST reflection interpreter', () => {

    describe('Inheritance with sub- and super-types', () => {

        const superType = new InterfaceType('Super', false, false);

        superType.properties.push({
            name: 'A',
            astNodes: new Set(),
            optional: false,
            type: {
                elementType: {
                    primitive: 'string'
                }
            }
        }, {
            name: 'Ref',
            astNodes: new Set(),
            optional: true,
            type: {
                referenceType: {
                    value: superType
                }
            }
        });

        const subType = new InterfaceType('Sub', false, false);
        subType.properties.push({
            name: 'B',
            astNodes: new Set(),
            optional: false,
            type: {
                elementType: {
                    primitive: 'string'
                }
            }
        });
        subType.superTypes.add(superType);

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
            })).toBe('Super');
            expect(reflectionForInheritance.getReferenceType({
                container: {
                    $type: 'Sub'
                },
                property: 'Ref',
                reference: undefined!
            })).toBe('Super');
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
