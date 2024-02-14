/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['packages/langium/src'],
            exclude: ['**/generated', '**/templates'],
        },
        deps: {
            interopDefault: true
        },
        include: ['**/test/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/generated/**', '**/templates/**', '**/examples/hello*/**'],
        watchExclude: [ '**/examples/hello*/**' /* populated by the yeoman generator test */],
    }
});
