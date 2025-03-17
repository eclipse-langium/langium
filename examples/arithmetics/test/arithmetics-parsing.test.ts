/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { createArithmeticsServices } from '../src/language-server/arithmetics-module.js';
import { EmptyFileSystem } from 'langium';
import type { Evaluation, Module } from '../src/language-server/generated/ast.js';
import { isBinaryExpression, isFunctionCall, isNumberLiteral, type Expression } from '../src/language-server/generated/ast.js';

describe('Test the arithmetics parsing', () => {

    const services = createArithmeticsServices(EmptyFileSystem);
    const parser = services.arithmetics.parser.LangiumParser;

    function printExpression(expr: Expression): string {
        if (isBinaryExpression(expr)) {
            return '(' + printExpression(expr.left) + ' ' + expr.operator + ' ' + printExpression(expr.right) + ')';
        } else if (isNumberLiteral(expr)) {
            return expr.value.toString();
        } else if (isFunctionCall(expr)) {
            return expr.func.$refText;
        }
        return '';
    }

    function parseExpression(text: string): Expression {
        const parseResult = parser.parse('module test ' + text);
        return ((parseResult.value as Module).statements[0] as Evaluation).expression;
    }

    test('Single expression', () => {
        const expr = parseExpression('1');
        expect(printExpression(expr)).toBe('1');
    });

    test('Binary expression', () => {
        const expr = parseExpression('1 + 2 ^ 3 * 4 % 5');
        expect(printExpression(expr)).toBe('(1 + ((2 ^ 3) * (4 % 5)))');
    });

    test('Nested expression', () => {
        const expr = parseExpression('(1 + 2) ^ 3');
        // Assert that the nested expression is correctly represented in the AST
        // If the expression parsing would be too eager, the result would be (1 + (2 ^ 3))
        expect(printExpression(expr)).toBe('((1 + 2) ^ 3)');
    });
});
