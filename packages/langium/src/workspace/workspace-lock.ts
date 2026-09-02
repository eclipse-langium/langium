/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { type AbstractCancellationTokenSource, CancellationToken, CancellationTokenSource } from '../utils/cancellation.js';
import { Deferred, isOperationCancelled, startCancelableOperation, type MaybePromise } from '../utils/promise-utils.js';

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
     * With {@link ReadPriority.Normal} priority (the default), read actions will only be executed after all write actions have finished.
     * They will be executed in parallel if possible.
     *
     * If a write action is currently running, the read action will be queued up and executed afterwards.
     * If a new write action is queued up while a read action is waiting, the write action will receive priority and will be handled before the read action.
     *
     * With {@link ReadPriority.Immediate} priority, the read action is executed right away, concurrently to any running write action.
     * Use this only if the required workspace/document state has already been awaited by other means.
     *
     * Note that read actions are not allowed to modify anything in the workspace. Please use {@link write} instead.
     */
    read<T>(action: () => MaybePromise<T>, priority?: ReadPriority): Promise<T>;

    /**
     * Cancels the last queued write action. All previous write actions already have been cancelled.
     */
    cancelWrite(): void;
}

type LockAction<T = void> = (token: CancellationToken) => MaybePromise<T>;

interface LockEntry {
    action: LockAction<unknown>;
    deferred: Deferred<unknown>;
    cancellationToken: CancellationToken;
}

export enum ReadPriority {
    /**
     * The read action is queued up and executed once all write actions have finished.
     */
    Normal,
    /**
     * The read action is executed immediately, even while a write action is running.
     */
    Immediate
}

export class DefaultWorkspaceLock implements WorkspaceLock {

    private previousTokenSource: AbstractCancellationTokenSource = new CancellationTokenSource();
    private writeQueue: LockEntry[] = [];
    private readQueue: LockEntry[] = [];
    private immediateReads: Array<Promise<unknown>> = [];
    private done = true;

    write(action: (token: CancellationToken) => MaybePromise<void>): Promise<void> {
        this.cancelWrite();
        const tokenSource = startCancelableOperation();
        this.previousTokenSource = tokenSource;
        return this.enqueue(this.writeQueue, action, tokenSource.token);
    }

    read<T>(action: () => MaybePromise<T>, priority: ReadPriority = ReadPriority.Normal): Promise<T> {
        if (priority === ReadPriority.Immediate) {
            // Immediate reads bypass the queue and run concurrently to any active write.
            // The caller is responsible for having awaited the workspace/document state it needs.
            // They are still tracked so that new write actions don't start while they are in progress.
            const promise = Promise.resolve().then(() => action());
            this.immediateReads.push(promise);
            const remove = () => {
                this.immediateReads.splice(this.immediateReads.indexOf(promise), 1);
            };
            promise.then(remove, remove);
            return promise;
        }
        return this.enqueue(this.readQueue, action);
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
        if (!this.done) {
            return;
        }
        const entries: LockEntry[] = [];
        if (this.writeQueue.length > 0) {
            // Just perform the next write action
            entries.push(this.writeQueue.shift()!);
            // A write action would modify the state that running immediate reads operate on,
            // so wait until all of them have finished before starting the write
            this.done = false;
            while (this.immediateReads.length > 0) {
                await Promise.allSettled(this.immediateReads.slice());
            }
        } else if (this.readQueue.length > 0) {
            // Empty the read queue and perform all actions in parallel
            entries.push(...this.readQueue.splice(0, this.readQueue.length));
            this.done = false;
        } else {
            return;
        }
        await Promise.all(entries.map(async ({ action, deferred, cancellationToken }) => {
            try {
                // Move the execution of the action to the next event loop tick via `Promise.resolve()`
                const result = await Promise.resolve().then(() => action(cancellationToken));
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
        this.done = true;
        this.performNextOperation();
    }

    cancelWrite(): void {
        this.previousTokenSource.cancel();
    }
}
