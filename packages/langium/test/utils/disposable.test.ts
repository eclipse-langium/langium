/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test, expect } from 'vitest';
import { Disposable } from 'langium';

describe('Disposable', () => {

    test('Sync disposable disposes instantly', () => {
        let disposed = false;
        const disposable = Disposable.create(() => disposed = true);
        disposable.dispose();
        expect(disposed).toBe(true);
    });

    test('Async disposable disposes during await', async () => {
        let disposed = false;
        const disposable = Disposable.create(() => new Promise<void>(resolve => {
            setTimeout(() => {
                disposed = true;
                resolve();
            }, 50);
        }));
        const promise = disposable.dispose();
        expect(disposed).toBe(false);
        await promise;
        expect(disposed).toBe(true);
    });

});
