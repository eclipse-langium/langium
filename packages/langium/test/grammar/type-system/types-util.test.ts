/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { InterfaceType, isAstType } from 'langium/grammar';

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

});
