/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { isNamed } from 'langium';

describe('Naming Tests', () => {

    // implemented to guard against issue #483, where a name bound to a cross-ref (non string) can crash the server
    test('Verify named nodes must have a string type', async () => {
        const testNode = {
            $type: 'terminal',
            name: {}
        };
        expect(isNamed(testNode)).toBeFalsy();
    });
});
