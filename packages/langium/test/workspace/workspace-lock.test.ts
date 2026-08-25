/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { Deferred, delayNextTick, DefaultWorkspaceLock, ReadPriority } from 'langium';

describe('WorkspaceLock', () => {

    test('Actions are executed sequentially', async () => {
        const size = 5;
        let counter = 0;
        const pushAction = async (deferred: Deferred) => {
            counter++;
            await deferred.promise;
        };
        const mutex = new DefaultWorkspaceLock();
        const deferredItems: Deferred[] = [];
        for (let i = 0; i < size; i++) {
            const deferred = new Deferred();
            deferredItems.push(deferred);
            mutex.write(() => pushAction(deferred));
        }
        for (let i = 0; i < size; i++) {
            await delayNextTick();
            expect(counter).toBe(i + 1);
            deferredItems[i].resolve();
        }
    });

    test('Write actions have higher priority than read actions', async () => {
        let counter = 0;
        const mutex = new DefaultWorkspaceLock();
        mutex.write(async () => {
            // Increase counter to 1
            counter++;
            await delayNextTick();
        });
        const counterRead = mutex.read(() => {
            // This read action has been queued after the first write action
            // However, write action always have priority over read actions
            // With the second write action executed first, the counter is 2
            return counter;
        });
        mutex.write(async () => {
            // Increase counter to 2
            counter++;
            await delayNextTick();
        });
        await delayNextTick();
        expect(counter).toBe(1);
        await delayNextTick();
        expect(counter).toBe(2);
        await delayNextTick();
        expect(await counterRead).toBe(2);
    });

    test('Write action results can be awaited', async () => {
        const mutex = new DefaultWorkspaceLock();
        const now = performance.now();
        const magicalNumber = await mutex.read(() => new Promise(resolve => setTimeout(() => resolve(42), 10)));
        // Confirm that at least 5ms have elapsed
        expect(performance.now() - now).toBeGreaterThanOrEqual(5);
        // Confirm the returned value
        expect(magicalNumber).toBe(42);
    });

    test('Actions can be cancelled explicitly', async () => {
        let counter = 0;
        const mutex = new DefaultWorkspaceLock();
        mutex.write(async token => {
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
        mutex.cancelWrite();
        await delayNextTick();
        // Counter is 1, since first action has been cancelled
        expect(counter).toBe(1);
    });

    test('Actions can be cancelled by enqueueing another action', async () => {
        let counter = 0;
        const mutex = new DefaultWorkspaceLock();
        mutex.write(async token => {
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
        mutex.write(async () => { counter--; });
        expect(counter).toBe(1);
        await delayNextTick();
        // Counter is 0, since first action has been cancelled
        // and the second action decreases the value again
        expect(counter).toBe(0);
    });

    test('Immediate read actions are executed concurrently to running write actions', async () => {
        let counter = 0;
        const mutex = new DefaultWorkspaceLock();
        const blocker = new Deferred();
        mutex.write(async () => {
            await blocker.promise;
            counter++;
        });
        await delayNextTick();
        // The write action is still running, but the immediate read is executed right away
        const immediateResult = await mutex.read(() => counter, ReadPriority.Immediate);
        expect(immediateResult).toBe(0);
        blocker.resolve();
        await delayNextTick();
        expect(counter).toBe(1);
    });

    test('Normal read actions wait for write actions, immediate ones do not', async () => {
        let counter = 0;
        const mutex = new DefaultWorkspaceLock();
        const blocker = new Deferred();
        mutex.write(async () => {
            await blocker.promise;
            counter++;
        });
        await delayNextTick();
        const normalRead = mutex.read(() => counter);
        const immediateRead = mutex.read(() => counter, ReadPriority.Immediate);
        // The immediate read resolves while the write action is still blocked
        expect(await immediateRead).toBe(0);
        blocker.resolve();
        // The normal read only resolves after the write action has finished
        expect(await normalRead).toBe(1);
    });

    test('Write actions do not start while immediate read actions are running', async () => {
        const mutex = new DefaultWorkspaceLock();
        let writeStarted = false;
        const readBlocker = new Deferred();
        const readAction = mutex.read(() => readBlocker.promise, ReadPriority.Immediate);
        mutex.write(async () => {
            writeStarted = true;
        });
        await delayNextTick();
        // The write action is queued, but must not start while the immediate read is in progress
        expect(writeStarted).toBe(false);
        readBlocker.resolve();
        await readAction;
        await delayNextTick();
        expect(writeStarted).toBe(true);
    });

    test('Immediate read actions return the action result', async () => {
        const mutex = new DefaultWorkspaceLock();
        const magicalNumber = await mutex.read(() => new Promise(resolve => setTimeout(() => resolve(42), 10)), ReadPriority.Immediate);
        expect(magicalNumber).toBe(42);
    });

    test('Immediate read actions propagate errors', async () => {
        const mutex = new DefaultWorkspaceLock();
        await expect(mutex.read(() => {
            throw new Error('Expected error');
        }, ReadPriority.Immediate)).rejects.toThrow('Expected error');
    });
});
