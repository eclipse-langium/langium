/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AbstractCancellationTokenSource } from 'vscode-jsonrpc';
import { CancellationToken, CancellationTokenSource } from 'vscode-jsonrpc';

export type MaybePromise<T> = T | Promise<T>

/**
 * Delays the execution of the current code to the next tick of the event loop.
 * Don't call this method directly in a tight loop to prevent too many promises from being created.
 */
export function delayNextTick(): Promise<void> {
    return new Promise(resolve => {
        // In case we are running in a non-node environment, `setImmediate` isn't available.
        // Using `setTimeout` of the browser API accomplishes the same result.
        if (typeof setImmediate === 'undefined') {
            setTimeout(resolve, 0);
        } else {
            setImmediate(resolve);
        }
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
 * Use this in a `catch` block to check whether the thrown object indicates that the operation
 * has been cancelled.
 */
export function isOperationCancelled(err: unknown): err is typeof OperationCancelled {
    return err === OperationCancelled;
}

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
    if (token.isCancellationRequested) {
        throw OperationCancelled;
    }
}

/**
 * Utility service to execute mutually exclusive actions.
 */
export interface MutexLock {
    /**
     * Performs a single async action, like initializing the workspace or processing document changes.
     * Only one action will be executed at a time.
     *
     * When another action is queued up, the token provided for the action will be cancelled.
     * Assuming the action makes use of this token, the next action only has to wait for the current action to finish cancellation.
     */
    write(action: (token: CancellationToken) => MaybePromise<void>): Promise<void>;

    /**
     * Performs a single action, like computing completion results or providing workspace symbols.
     * Read actions will only be executed after all write actions have finished. They will be executed in parallel if possible.
     *
     * If a write action is currently running, the read action will be queued up and executed afterwards.
     * If a new write action is queued up while a read action is waiting, the write action will receive priority and will be handled before the read action.
     *
     * Note that read actions are not allowed to modify anything in the workspace. Please use {@link write} instead.
     *
     */
    read<T>(action: () => MaybePromise<T>): MaybePromise<T>;

    /**
     * Cancels the currently executed write action.
     */
    cancel(): void;
}

type MutexAction<T = void> = (token: CancellationToken) => MaybePromise<T>;

interface MutexEntry {
    action: MutexAction<unknown>;
    deferred: Deferred<unknown>;
    cancellationToken: CancellationToken;
}

export class DefaultMutexLock implements MutexLock {

    private previousTokenSource = new CancellationTokenSource();
    private writeQueue: MutexEntry[] = [];
    private readQueue: MutexEntry[] = [];
    private done = true;

    write(action: (token: CancellationToken) => MaybePromise<void>): Promise<void> {
        this.cancel();
        const tokenSource = new CancellationTokenSource();
        this.previousTokenSource = tokenSource;
        return this.enqueue(this.writeQueue, action, tokenSource.token);
    }

    read<T>(action: () => MaybePromise<T>): Promise<T> {
        return this.enqueue(this.readQueue, action);
    }

    private enqueue<T = void>(queue: MutexEntry[], action: MutexAction<T>, cancellationToken?: CancellationToken): Promise<T> {
        const deferred = new Deferred<unknown>();
        const entry: MutexEntry = {
            action,
            deferred,
            cancellationToken: cancellationToken ?? CancellationToken.None
        };
        queue.push(entry);
        this.tryPerformNextOperation();
        return deferred.promise as Promise<T>;
    }

    private tryPerformNextOperation(): void {
        if (this.done) {
            this.performNextOperation();
        }
    }

    private performNextOperation(): void {
        if (this.writeQueue.length > 0) {
            // Just perform the next write action
            this.performOperation([this.writeQueue.shift()!]);
        } else if (this.readQueue.length > 0) {
            // Empty the read queue and perform all actions in parallel
            const entries = this.readQueue.splice(0, this.readQueue.length);
            this.performOperation(entries);
        }
    }

    private performOperation(entries: MutexEntry[]): void {
        if (!this.done) {
            throw new Error('Mutex is not ready to accept new operation');
        }
        this.done = false;
        let completed = 0;
        const goToNext = () => {
            completed += 1;
            if (completed === entries.length) {
                this.done = true;
                this.performNextOperation();
            }
        };
        for (const entry of entries) {
            const { action, deferred, cancellationToken } = entry;
            Promise.resolve().then(() => action(cancellationToken)).then(result => {
                deferred.resolve(result);
            }).catch(err => {
                if (isOperationCancelled(err)) {
                    // If the operation was cancelled, we don't want to reject the promise
                    deferred.resolve(undefined);
                } else {
                    deferred.reject(err);
                }
            }).finally(() => {
                goToNext();
            });
        }
    }

    /**
     * Cancels the currently executed action
     */
    cancel(): void {
        this.previousTokenSource.cancel();
    }
}

/**
 * Simple implementation of the deferred pattern.
 * An object that exposes a promise and functions to resolve and reject it.
 */
export class Deferred<T = void> {
    resolve: (value: T) => this;
    reject: (err?: unknown) => this;

    promise = new Promise<T>((resolve, reject) => {
        this.resolve = (arg) => (resolve(arg), this);
        this.reject = (err) => (reject(err), this);
    });
}
