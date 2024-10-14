/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Disposable } from './disposable.js';
import { Emitter, Event } from './event.js';
import { delayNextTick } from './promise-utils.js';

let lastTick = 0;
let globalInterruptionPeriod = 10;

/**
 * Reset the global interruption period and create a cancellation token source.
 *
 * @deprecated Use {@link CancellationTokenSource} directly instead.
 */
export function startCancelableOperation(): AbstractCancellationTokenSource {
    lastTick = Date.now();
    return new CancellationTokenSource();
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
 * Change the period duration for {@link CancellationToken#check} and {@link interruptAndCheck} to the given number of milliseconds.
 * The default value is 10ms.
 */
export function setInterruptionPeriod(period: number): void {
    globalInterruptionPeriod = period;
}

/**
 * This function does two things:
 *  1. Check the elapsed time since the last call to this function or to {@link startCancelableOperation}. If the predefined
 *     period (configured with {@link setInterruptionPeriod}) is exceeded, execution is delayed with {@link delayNextTick}.
 *  2. If the predefined period is not met yet or execution is resumed after an interruption, the given cancellation
 *     token is checked, and if cancellation is requested, {@link OperationCancelled} is thrown.
 *
 * All services in Langium that receive a `CancellationToken` may potentially call this function, so the
 * {@link OperationCancelled} must be caught (with an `async` try-catch block or a `catch` callback attached to
 * the promise) to avoid that event being exposed as an error.
 *
 * @deprecated Use {@link CancellationToken#check} instead.
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

export interface SimpleCancellationToken {
    /**
     * Is `true` when the token has been cancelled, `false` otherwise.
     */
    readonly isCancellationRequested: boolean;
    /**
     * An {@link Event event} which fires upon cancellation.
     */
    readonly onCancellationRequested: Event<void>;
}

/**
 * Defines a CancellationToken. This interface is not
 * intended to be implemented. A CancellationToken must
 * be created via a CancellationTokenSource.
 */
export interface CancellationToken extends SimpleCancellationToken {
    /**
     * This function does two things:
     *  1. Check the elapsed time since the last call to this function or the creation time of this token. If the predefined
     *     period (configured with {@link setInterruptionPeriod}) is exceeded, execution is delayed with {@link delayNextTick}.
     *  2. If the predefined period is not met yet or execution is resumed after an interruption, the given cancellation
     *     token is checked, and if cancellation is requested, {@link OperationCancelled} is thrown.
     *
     * All services in Langium that receive a {@link CancellationToken} may potentially call this function, so the
     * {@link OperationCancelled} must be caught (with an `async` try-catch block or a `catch` callback attached to
     * the promise) to avoid that event being exposed as an error.
     */
    check(): Promise<void>;
}

export namespace CancellationToken {
    export const None: CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: Event.None,
        check: () => Promise.resolve()
    };
    export const Cancelled: CancellationToken = {
        isCancellationRequested: true,
        onCancellationRequested: Event.None,
        check: () => {
            throw OperationCancelled;
        }
    };
    export function is(value: unknown): value is CancellationToken {
        return typeof value === 'object' && !!value
            && 'isCancellationRequested' in value
            && 'onCancellationRequested' in value;
    }
    export function create(other: SimpleCancellationToken): CancellationToken {
        let time = performance.now();
        return {
            get isCancellationRequested() {
                return other.isCancellationRequested;
            },
            onCancellationRequested: other.onCancellationRequested,
            async check() {
                const now = performance.now();
                if (time - now >= 10) {
                    time = now;
                    await delayNextTick();
                }
                if (other.isCancellationRequested) {
                    throw OperationCancelled;
                }
            }
        };
    }
}

class MutableToken implements CancellationToken {

    private _tick = performance.now();
    private _isCancelled: boolean = false;
    private _emitter: Emitter<void> | undefined;

    public cancel() {
        if (!this._isCancelled) {
            this._isCancelled = true;
            if (this._emitter) {
                this._emitter.fire(undefined);
                this.dispose();
            }
        }
    }

    get isCancellationRequested(): boolean {
        return this._isCancelled;
    }

    get onCancellationRequested(): Event<void> {
        if (!this._emitter) {
            this._emitter = new Emitter<void>();
        }
        return this._emitter.event;
    }

    async check(): Promise<void> {
        const now = performance.now();
        if (now - this._tick >= globalInterruptionPeriod) {
            this._tick = now;
            await delayNextTick();
        }
        if (this.isCancellationRequested) {
            throw OperationCancelled;
        }
    }

    public dispose(): void {
        if (this._emitter) {
            this._emitter.dispose();
            this._emitter = undefined;
        }
    }
}

export interface AbstractCancellationTokenSource extends Disposable {
    token: CancellationToken;
    cancel(): void;
}

export class CancellationTokenSource implements AbstractCancellationTokenSource {

    private _token: CancellationToken | undefined;

    get token(): CancellationToken {
        if (!this._token) {
            // be lazy and create the token only when
            // actually needed
            this._token = new MutableToken();
        }
        return this._token;
    }

    cancel(): void {
        if (!this._token) {
            // save an object by returning the default
            // cancelled token when cancellation happens
            // before someone asks for the token
            this._token = CancellationToken.Cancelled;
        } else {
            (<MutableToken>this._token).cancel();
        }
    }

    dispose(): void {
        if (!this._token) {
            // ensure to initialize with an empty token if we had none
            this._token = CancellationToken.None;
        } else if (this._token instanceof MutableToken) {
            // actually dispose
            this._token.dispose();
        }
    }
}