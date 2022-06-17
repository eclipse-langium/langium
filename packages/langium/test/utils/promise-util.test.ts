/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Deferred, delayNextTick, ReadWriteMutex } from '../../src';

describe('Mutex locking', () => {

    test('Reading is possible in parallel', async () => {
        const max = 5;
        let counter = 0;
        const deferred = new Deferred();
        const popAction = async () => {
            counter++;
            await deferred.promise;
        };
        const mutex = new ReadWriteMutex();
        for (let i = 0; i < max; i++) {
            mutex.read(() => popAction());
        }
        await delayNextTick();
        // Counter has been increased even though the promise hasn't been resolved
        expect(counter).toBe(max);
    });

    test('Writing is not possible in parallel', async () => {
        const size = 5;
        let counter = 0;
        const pushAction = async (deferred: Deferred) => {
            counter++;
            await deferred.promise;
        };
        const mutex = new ReadWriteMutex();
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

    test('Reading waits for writing', async () => {
        let counter = 0;
        const popAction = async () => {
            counter--;
        };
        const pushDeferred = new Deferred();
        const pushAction = async () => {
            counter++;
            await pushDeferred.promise;
        };
        const mutex = new ReadWriteMutex();
        expect(counter).toBe(0);
        mutex.write(() => pushAction());
        mutex.read(() => popAction());
        await delayNextTick();
        // Write is executing, read is waiting
        expect(counter).toBe(1);
        pushDeferred.resolve();
        await delayNextTick();
        // Read has been executing
        expect(counter).toBe(0);
    });

    test('Writing waits for reading', async () => {
        let counter = 0;
        const popDeferred = new Deferred();
        const popAction = async () => {
            counter--;
            await popDeferred.promise;
        };
        const pushAction = async () => {
            counter++;
        };
        const mutex = new ReadWriteMutex();
        expect(counter).toBe(0);
        mutex.read(() => popAction());
        await delayNextTick();
        mutex.write(() => pushAction());
        await delayNextTick();
        // Read is executing, write is waiting
        expect(counter).toBe(-1);
        popDeferred.resolve();
        await delayNextTick();
        // Write has been executing
        expect(counter).toBe(0);
    });

    test('Reading waits for multiple writes', async () => {
        let counter = 0;
        const pushDeferred1 = new Deferred();
        const pushDeferred2 = new Deferred();
        const popAction = async () => {
            counter--;
        };
        const pushAction = async (deferred: Deferred) => {
            counter++;
            await deferred.promise;
        };
        const mutex = new ReadWriteMutex();
        expect(counter).toBe(0);
        mutex.write(() => pushAction(pushDeferred1));
        mutex.read(() => popAction());
        mutex.write(() => pushAction(pushDeferred2));
        mutex.read(() => popAction());
        await delayNextTick();
        // First write is executing, reads are waiting
        expect(counter).toBe(1);
        pushDeferred1.resolve();
        await delayNextTick();
        // Second write is executed, although first read has been queued up
        expect(counter).toBe(2);
        pushDeferred2.resolve();
        await delayNextTick();
        // Both reads are executed in parallel
        expect(counter).toBe(0);
    });

    test('Writing has priority over reading if executed in sequence', async () => {
        let counter = 0;
        const popAction = async () => {
            counter--;
        };
        const pushDeferred = new Deferred();
        const pushAction = async () => {
            counter++;
            await pushDeferred.promise;
        };
        const mutex = new ReadWriteMutex();
        expect(counter).toBe(0);
        mutex.read(() => popAction());
        mutex.write(() => pushAction());
        await delayNextTick();
        // Write is executing, read is waiting
        expect(counter).toBe(1);
        pushDeferred.resolve();
        await delayNextTick();
        // Read has been executing
        expect(counter).toBe(0);
    });

});
