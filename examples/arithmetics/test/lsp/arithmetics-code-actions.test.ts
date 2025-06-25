/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { testCodeAction } from 'langium/test';
import { createArithmeticsServices } from '../../src/language-server/arithmetics-module.js';
import { IssueCodes } from '../../src/language-server/arithmetics-validator.js';

const services = createArithmeticsServices(EmptyFileSystem);
const testCodeActions = testCodeAction(services.arithmetics);

describe('Arithmetics code actions', () => {
    test('Replace normalizable expression with constant', async () => {
        const textBefore = `
            module test
            def foo: 2 + 3;
        `;

        const textAfter = `
            module test
            def foo: 5;
        `;

        const result = await testCodeActions(textBefore, IssueCodes.ExpressionNormalizable, textAfter);
        const action = result.action;
        expect(action).toBeTruthy();
        expect(action!.title).toBe('Replace with constant 5');
    });
});

