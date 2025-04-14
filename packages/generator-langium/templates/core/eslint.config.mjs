import js from '@eslint/js';
import globals from 'globals';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';

import pluginTypescriptEslint from '@typescript-eslint/eslint-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        '**/node_modules/**/*',
        '**/bin/**/*',
        '**/bundle/**/*',
        '**/dist/**/*',
        '**/lib/**/*',
        '**/*env.d.ts'
    ],
}, ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'), {
    files: [
        '**/src/**/*.ts',
        '**/src/**/*.tsx',
        '**/test/**/*.ts',
        '**/test/**/*.tsx'
    ],
    plugins: {
        '@typescript-eslint': pluginTypescriptEslint,
    },
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.browser
        },
        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: 'module',
        parserOptions: {
            project: ['./tsconfig.json']
        }
    },
    rules: {
    }
}];
