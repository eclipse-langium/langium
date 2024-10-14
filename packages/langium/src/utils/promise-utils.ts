/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

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

/**
 * Simple implementation of the deferred pattern.
 * An object that exposes a promise and functions to resolve and reject it.
 */
export class Deferred<T = void> {
    resolve: (value: T) => this;
    reject: (err?: unknown) => this;

    promise = new Promise<T>((resolve, reject) => {
        this.resolve = (arg) => {
            resolve(arg);
            return this;
        };
        this.reject = (err) => {
            reject(err);
            return this;
        };
    });
}
