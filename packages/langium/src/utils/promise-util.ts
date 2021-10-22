/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractCancellationTokenSource, CancellationToken, CancellationTokenSource } from 'vscode-jsonrpc';

export type MaybePromise<T> = T | Promise<T>

/**
 * Delays the execution of the current code to the next tick of the event loop.
 * Don't call this method directly in a tight loop to prevent too many promises from being created.
 */
export function delayNextTick(): Promise<void> {
    return new Promise(resolve => {
        setImmediate(resolve);
    });
}

let lastTick = 0;
let globalInterruptionPeriod = 10;

/**
 * Reset the global interruption period and create a cancellation token source.
 */
export function startCancelableOperation(): AbstractCancellationTokenSource {
    lastTick = Date.now();
    return new CancellationTokenSource();
}

/**
 * Change the period duration for `interruptAndCheck` to the given number of milliseconds.
 * The default value is 10ms.
 */
export function setInterruptionPeriod(period: number): void {
    globalInterruptionPeriod = period;
}

/**
 * This symbol may be thrown in an asynchronous context by any Langium service that receives
 * a `CancellationToken`. This means that the promise returned by such a service is rejected with
 * this symbol as rejection reason.
 */
export const OperationCancelled = Symbol('OperationCancelled');

/**
 * This function does two things:
 *  1. Check the elapsed time since the last call to this function or to `startCancelableOperation`. If the predefined
 *     period (configured with `setInterruptionPeriod`) is exceeded, execution is delayed with `delayNextTick`.
 *  2. If the predefined period is not met yet or execution is resumed after an interruption, the given cancellation
 *     token is checked, and if cancellation is requested, `OperationCanceled` is thrown.
 *
 * All services in Langium that receive a `CancellationToken` may potentially call this function, so the
 * `CancellationToken` must be caught (with an `async` try-catch block or a `catch` callback attached to
 * the promise) to avoid that event being exposed as an error.
 */
export async function interruptAndCheck(token: CancellationToken): Promise<void> {
    if (token === CancellationToken.None) {
        // Early exit in case cancellation was disabled by the caller
        return;
    }
    const current = Date.now();
    if (current - lastTick >= globalInterruptionPeriod) {
        lastTick = current;
        await delayNextTick();
    }
    if (token. isCancellationRequested) {
        throw OperationCancelled;
    }
}
