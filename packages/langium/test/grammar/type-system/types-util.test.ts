/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import type { ValueType } from 'langium/grammar';
import { InterfaceType, UnionType, isAstType } from 'langium/grammar';

describe('isAstType', () => {

    test('Should return true on normal interface type', () => {
        expect(isAstType({
            value: new InterfaceType('Test', true, false)
        })).toBeTruthy();
    });

    test('Should return false on reference type', () => {
        expect(isAstType({
            referenceType: {
                value: new InterfaceType('Test', true, false)
            }
        })).toBeFalsy();
    });

    test('Should return false on primitive type', () => {
        expect(isAstType({
            primitive: 'string'
        })).toBeFalsy();
    });

    test('Should return false on string type', () => {
        expect(isAstType({
            string: 'x'
        })).toBeFalsy();
    });

    test('Should return true for AST union types', () => {
        expect(isAstType({
            types: [
                {
                    value: new InterfaceType('A', true, false)
                },
                {
                    value: new InterfaceType('B', true, false)
                }
            ]
        })).toBeTruthy();
    });

    test('Should return false for primitive union types', () => {
        expect(isAstType({
            types: [
                {
                    primitive: 'number'
                },
                {
                    primitive: 'string'
                }
            ]
        })).toBeFalsy();
    });

    test('Should return false for mixed union types', () => {
        expect(isAstType({
            types: [
                {
                    primitive: 'string'
                },
                {
                    value: new InterfaceType('B', true, false)
                }
            ]
        })).toBeFalsy();
    });

    test('Should return false for primitive union type with cycles', () => {
        const unionType = new UnionType('Test');
        const valueType: ValueType = {
            value: unionType
        };
        unionType.type = {
            types: [
                {
                    primitive: 'string'
                },
                valueType
            ]
        };
        expect(isAstType(unionType.type)).toBeFalsy();
    });

    test('Should return true for interface union type with cycles', () => {
        const unionType = new UnionType('A');
        const valueType: ValueType = {
            value: unionType
        };
        unionType.type = {
            types: [
                {
                    value: new InterfaceType('B', true, false)
                },
                valueType
            ]
        };
        expect(isAstType(unionType.type)).toBeTruthy();
    });

    test('Should return true for nested duplicate union types', () => {
        const unionType1 = new UnionType('A');
        const unionType2 = new UnionType('B');
        const interfaceType1 = new InterfaceType('C', true, false);
        const interfaceType2 = new InterfaceType('D', true, false);
        unionType1.type = {
            types: [
                {
                    value: interfaceType1
                },
                {
                    value: unionType2
                }
            ]
        };
        unionType2.type = {
            types: [
                {
                    value: interfaceType1 // duplicate
                },
                {
                    value: interfaceType2
                }
            ]
        };
        expect(isAstType(unionType1.type)).toBeTruthy();
    });

    test('Should return true for cyclic AST type', () => {
        const unionType = new UnionType('Test');
        const type: ValueType = {
            value: unionType
        };
        unionType.type = type;
        expect(isAstType(type)).toBeTruthy();
    });

});
