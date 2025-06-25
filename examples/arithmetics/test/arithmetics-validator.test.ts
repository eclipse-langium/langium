/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { createArithmeticsServices } from '../src/language-server/arithmetics-module.js';
import { EmptyFileSystem } from 'langium';
import { expectError, expectIssue, expectNoIssues, validationHelper } from 'langium/test';
import type { Module, Definition, BinaryExpression, FunctionCall, DeclaredParameter } from '../src/language-server/generated/ast.js';
import { IssueCodes } from '../src/language-server/arithmetics-validator.js';

const services = createArithmeticsServices(EmptyFileSystem);
const validate = validationHelper<Module>(services.arithmetics);

describe('Arithmetics validation', () => {

    test('Division by zero should be detected', async () => {
        const validationResult = await validate(`
            module test
            5 / 0;
        `);

        expectError(validationResult, 'Division by zero is detected.', {
            property: 'right'
        });
    });

    test('Modulo by zero should be detected', async () => {
        const validationResult = await validate(`
            module test
            5 % 0;
        `);

        expectError(validationResult, 'Division by zero is detected.', {
            property: 'right'
        });
    });

    test('Division by non-zero should not cause error', async () => {
        const validationResult = await validate(`
            module test
            5 / 2;
        `);

        expectNoIssues(validationResult);
    });

    test('Expression normalization should be suggested', async () => {
        const validationResult = await validate(`
            module test
            def test: 2 + 3;
        `);

        expectIssue(validationResult, {
            message: 'Expression could be normalized to constant 5',
            data: {
                code: IssueCodes.ExpressionNormalizable,
                constant: 5
            }
        });
    });

    test('Duplicate definition names should be detected', async () => {
        const validationResult = await validate(`
            module test
            def x: 1;
            def x: 2;
        `);

        const module = validationResult.document.parseResult.value;
        const firstDef = module.statements[0] as Definition;
        const secondDef = module.statements[1] as Definition;

        expect(validationResult.diagnostics).toHaveLength(2);
        expectError(validationResult, 'Duplicate definition name: x', {
            node: firstDef,
            property: 'name'
        });
        expectError(validationResult, 'Duplicate definition name: x', {
            node: secondDef,
            property: 'name'
        });
    });

    test('Unique definition names should not cause error', async () => {
        const validationResult = await validate(`
            module test
            def x: 1;
            def y: 2;
        `);

        expectNoIssues(validationResult);
    });

    test('Function recursion should be detected', async () => {
        const validationResult = await validate(`
            module test
            def factorial(n): factorial(n - 1);
        `);

        const module = validationResult.document.parseResult.value;
        const def = module.statements[0] as Definition;
        const binaryExpr = def.expr as BinaryExpression;
        const funcCall = binaryExpr.left as FunctionCall;

        expectError(validationResult, /Recursion is not allowed/, {
            node: funcCall,
            property: 'func'
        });
    });

    test('Function mutual recursion should be detected', async () => {
        const validationResult = await validate(`
            module test
            def even(n): odd(n - 1);
            def odd(n): even(n - 1);
        `);

        expect(validationResult.diagnostics.length).toBeGreaterThan(0);
        expectError(validationResult, /Recursion is not allowed/, {
            property: 'func'
        });
    });

    test('Non-recursive function calls should not cause error', async () => {
        const validationResult = await validate(`
            module test
            def add(a, b): a + b;
            def calculate: add(2, 3);
        `);

        expectNoIssues(validationResult);
    });

    test('Duplicate parameter names should be detected', async () => {
        const validationResult = await validate(`
            module test
            def test(x, x): x + 1;
        `);

        const module = validationResult.document.parseResult.value;
        const def = module.statements[0] as Definition;
        const firstParam = def.args[0] as DeclaredParameter;
        const secondParam = def.args[1] as DeclaredParameter;

        expect(validationResult.diagnostics).toHaveLength(2);
        expectError(validationResult, 'Duplicate definition name: x', {
            node: firstParam,
            property: 'name'
        });
        expectError(validationResult, 'Duplicate definition name: x', {
            node: secondParam,
            property: 'name'
        });
    });

    test('Unique parameter names should not cause error', async () => {
        const validationResult = await validate(`
            module test
            def test(x, y): x + y;
        `);

        expectNoIssues(validationResult);
    });

    test('Function call parameter count mismatch should be detected', async () => {
        const validationResult = await validate(`
            module test
            def add(a, b): a + b;
            add(1, 2, 3);
        `);

        expectError(validationResult, 'Function add expects 2 parameters, but 3 were given.', {
            property: 'args'
        });
    });

    test('Function call with too few parameters should be detected', async () => {
        const validationResult = await validate(`
            module test
            def add(a, b): a + b;
            add(1);
        `);

        expectError(validationResult, 'Function add expects 2 parameters, but 1 were given.', {
            property: 'args'
        });
    });

    test('Function call with correct parameter count should not cause error', async () => {
        const validationResult = await validate(`
            module test
            def add(a, b): a + b;
            add(1, 2);
        `);

        expectNoIssues(validationResult);
    });

    test('Function call with no parameters should work when function expects none', async () => {
        const validationResult = await validate(`
            module test
            def pi: 3.14159;
            pi;
        `);

        expectNoIssues(validationResult);
    });
});

