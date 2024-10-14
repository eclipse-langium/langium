/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CancellationTokenSource, isOperationCancelled } from '../utils/cancellation.js';
import { Deferred, delayNextTick, type MaybePromise } from '../utils/promise-utils.js';

/**
 * Utility service to execute mutually exclusive actions.
 */
export interface WorkspaceLock {
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
     * Read actions will be executed in parallel if possible.
     *
     * Note that read actions are not allowed to modify anything in the workspace. Please use {@link write} instead.
     *
     * @param action the action to perform.
     * @param priority the priority for this action. See {@link WorkspaceLockPriority} for more info.
     */
    read<T>(action: () => MaybePromise<T>, priority?: WorkspaceLockPriority): Promise<T>;

    /**
     * Cancels the last queued write action. All previous write actions already have been cancelled.
     */
    cancelWrite(): void;
}

export enum WorkspaceLockPriority {
    /**
     * The action is put into the queue and executed after the current write action is done.
     * If the action in question is a read action, it will be executed in parallel with other read actions.
     * The action will block the lock until it is done or has been aborted.
     */
    Normal = 0,
    /**
     * The action should be executed immediately, and afterwards behaves like a normal action.
     */
    Immediate = 1
}

type LockAction<T = void> = (token: CancellationToken) => MaybePromise<T>;

interface LockEntry {
    action: LockAction<unknown>;
    deferred: Deferred<unknown>;
    cancellationToken: CancellationToken;
}

export class DefaultWorkspaceLock implements WorkspaceLock {

    private previousTokenSource = new CancellationTokenSource();
    private writeQueue: LockEntry[] = [];
    private readQueue: LockEntry[] = [];
    private counter = 0;

    write(action: (token: CancellationToken) => MaybePromise<void>): Promise<void> {
        this.cancelWrite();
        const tokenSource = new CancellationTokenSource();
        this.previousTokenSource = tokenSource;
        return this.enqueue(this.writeQueue, action, tokenSource.token);
    }

    read<T>(action: () => MaybePromise<T>, priority?: WorkspaceLockPriority): Promise<T> {
        if (priority === WorkspaceLockPriority.Immediate) {
            this.counter++;
            const deferred = new Deferred<T>();
            (async () => {
                try {
                    await delayNextTick();
                    const result = await action();
                    deferred.resolve(result);
                } catch (err) {
                    deferred.reject(err);
                } finally {
                    this.counter--;
                    this.performNextOperation();
                }
            })();
            return deferred.promise;
        } else {
            return this.enqueue(this.readQueue, action);
        }
    }

    private enqueue<T = void>(queue: LockEntry[], action: LockAction<T>, cancellationToken = CancellationToken.None): Promise<T> {
        const deferred = new Deferred<unknown>();
        const entry: LockEntry = {
            action,
            deferred,
            cancellationToken
        };
        queue.push(entry);
        this.performNextOperation();
        return deferred.promise as Promise<T>;
    }

    private async performNextOperation(): Promise<void> {
        if (this.counter > 0) {
            return;
        }
        const entries: LockEntry[] = [];
        if (this.writeQueue.length > 0) {
            // Just perform the next write action
            entries.push(this.writeQueue.shift()!);
        } else if (this.readQueue.length > 0) {
            // Empty the read queue and perform all actions in parallel
            entries.push(...this.readQueue.splice(0, this.readQueue.length));
        } else {
            return;
        }
        this.counter += entries.length;
        await Promise.all(entries.map(async ({ action, deferred, cancellationToken }) => {
            try {
                // Move the execution of the action to the next event loop tick
                await delayNextTick();
                const result = await action(cancellationToken);
                deferred.resolve(result);
            } catch (err) {
                if (isOperationCancelled(err)) {
                    // If the operation was cancelled, we don't want to reject the promise
                    deferred.resolve(undefined);
                } else {
                    deferred.reject(err);
                }
            }
        }));
        this.counter -= entries.length;
        this.performNextOperation();
    }

    cancelWrite(): void {
        this.previousTokenSource.cancel();
    }
}
