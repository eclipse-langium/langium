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
 * Utility class to allow for mutually exclusive read and write access.
 *
 * Can perform multiple read accesses at the same time, but only one write access.
 */
export class ReadWriteMutex {

    private readCount = 0;
    private writeCount = 0;

    private writeLock: Deferred = new Deferred().resolve();
    private readLock: Deferred = new Deferred().resolve();

    private previousWriteAction?: Promise<void>;

    /**
     * Performs a single async write action, like initializing the workspace or processing document changes.
     * Only one action will be executed at a time.
     *
     * If a write action is queued up while a read action is being performed, the write action will wait until all read actions have completed.
     */
    async write(action: () => Promise<void>): Promise<void> {
        // Lock reading first, so that consequent read requests don't have priority over this write request
        this.lockRead();
        // Then await that every read previous action has completed
        await this.readLock.promise;
        // Append the new action to the previous action. We usually don't have to wait for long, as the previous write action
        // 1. has either completed
        // 2. has been cancelled due to the new write request
        this.previousWriteAction = (this.previousWriteAction ?? Promise.resolve()).then(() =>
            action().catch(err => {
                if (!isOperationCancelled(err)) {
                    console.error('Error: ', err);
                }
            }).finally(() => {
                this.unlockRead();
            })
        );
    }

    /**
     * Call this to lock this mutex before a write operation.
     */
    private lockRead(): void {
        if (this.writeCount === 0) {
            this.writeLock.resolve();
            this.writeLock = new Deferred();
        }
        this.writeCount++;
    }

    /**
     * Call this to unlock this mutex after a write operation.
     */
    private unlockRead(): void {
        this.writeCount--;
        if (this.writeCount === 0) {
            this.writeLock.resolve();
        }
    }

    /**
     * Performs a read action on the language server. Multiple read actions can be performed at a time.
     *
     * If a read action is queued up while a write action is being performed, the read action will wait until the write action has completed.
     */
    async read<T>(action: () => Promise<T>): Promise<T> {
        // Wait one tick for any write request to arrive
        await delayNextTick();
        // Await that writing has completed
        await this.writeLock.promise;
        // Then lock writing
        this.lockWrite();
        return action().finally(() => this.unlockWrite());
    }

    /**
     * Call this to lock this mutex before a read operation.
     */
    private lockWrite(): void {
        if (this.readCount === 0) {
            this.readLock.resolve();
            this.readLock = new Deferred();
        }
        this.readCount++;
    }

    /**
     * Call this to lock this mutex after a read operation.
     */
    private unlockWrite(): void {
        this.readCount--;
        if (this.readCount === 0) {
            this.readLock.resolve();
        }
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
