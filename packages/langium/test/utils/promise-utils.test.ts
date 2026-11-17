/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Cancellation, interruptAndCheck, interruptionDue, isOperationCancelled, setInterruptionPeriod, startCancelableOperation } from 'langium';
import { afterEach, describe, expect, test } from 'vitest';

describe('interruptionDue', () => {

    afterEach(() => {
        setInterruptionPeriod(10);
    });

    test('is false for CancellationToken.None, even when the interruption period has passed', () => {
        setInterruptionPeriod(0);
        expect(interruptionDue(Cancellation.CancellationToken.None)).toBe(false);
    });

    test('is false within the interruption period while the token is not cancelled', () => {
        setInterruptionPeriod(Number.POSITIVE_INFINITY);
        const source = startCancelableOperation();
        expect(interruptionDue(source.token)).toBe(false);
    });

    test('is true once the token is cancelled, and interruptAndCheck then throws', async () => {
        setInterruptionPeriod(Number.POSITIVE_INFINITY);
        const source = startCancelableOperation();
        source.cancel();
        expect(interruptionDue(source.token)).toBe(true);
        const rejection = await interruptAndCheck(source.token).then(() => undefined, (err: unknown) => err);
        expect(isOperationCancelled(rejection)).toBe(true);
    });

    test('is true once the interruption period has passed, and false again after interruptAndCheck yielded', async () => {
        setInterruptionPeriod(0);
        const source = startCancelableOperation();
        expect(interruptionDue(source.token)).toBe(true);
        setInterruptionPeriod(Number.POSITIVE_INFINITY);
        expect(interruptionDue(source.token)).toBe(false);
        setInterruptionPeriod(5);
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(interruptionDue(source.token)).toBe(true);
        await interruptAndCheck(source.token);
        expect(interruptionDue(source.token)).toBe(false);
    });
});
