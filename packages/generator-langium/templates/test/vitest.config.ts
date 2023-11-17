/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://vitest.dev/config/
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // coverage: {
        //     provider: 'v8',
        //     reporter: ['text', 'html'],
        //     include: ['src'],
        //     exclude: ['**/generated'],
        // },
        deps: {
            interopDefault: true
        },
        include: ['**/*.test.ts']
    }
});
