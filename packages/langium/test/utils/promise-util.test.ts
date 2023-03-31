/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { Deferred, delayNextTick, MutexLock } from '../../src';

describe('Mutex locking', () => {

    test('Actions are executed sequentially', async () => {
        const size = 5;
        let counter = 0;
        const pushAction = async (deferred: Deferred) => {
            counter++;
            await deferred.promise;
        };
        const mutex = new MutexLock();
        const deferredItems: Deferred[] = [];
        for (let i = 0; i < size; i++) {
            const deferred = new Deferred();
            deferredItems.push(deferred);
            mutex.lock(() => pushAction(deferred));
        }
        for (let i = 0; i < size; i++) {
            await delayNextTick();
            expect(counter).toBe(i + 1);
            deferredItems[i].resolve();
        }
    });

    test('Actions can be cancelled explicitly', async () => {
        let counter = 0;
        const mutex = new MutexLock();
        mutex.lock(async token => {
            // Increase counter to 1
            counter++;
            await delayNextTick();
            if (token.isCancellationRequested) {
                return;
            }
            // Increase counter to 2
            counter++;
        });

        await delayNextTick();
        expect(counter).toBe(1);
        mutex.cancel();
        await delayNextTick();
        // Counter is 1, since first action has been cancelled
        expect(counter).toBe(1);
    });

    test('Actions can be cancelled by enqueueing another action', async () => {
        let counter = 0;
        const mutex = new MutexLock();
        mutex.lock(async token => {
            // Increase counter to 1
            counter++;
            await delayNextTick();
            if (token.isCancellationRequested) {
                return;
            }
            // Increase counter to 2
            counter++;
        });

        await delayNextTick();
        expect(counter).toBe(1);
        mutex.lock(async () => { counter--; });
        expect(counter).toBe(1);
        await delayNextTick();
        // Counter is 0, since first action has been cancelled
        // and the second action decreases the value again
        expect(counter).toBe(0);
    });
});
