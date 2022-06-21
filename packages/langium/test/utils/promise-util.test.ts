/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

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
});
