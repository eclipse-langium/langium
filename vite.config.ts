/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'c8',
            reporter: ['text', 'html'],
            include: ['packages/langium/src'],
            exclude: ['**/generated'],
        },
        deps: {
            interopDefault: true
        }
    }
});
