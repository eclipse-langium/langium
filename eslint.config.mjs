import js from '@eslint/js';
import globals from 'globals';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';

import pluginTypescriptEslint from '@typescript-eslint/eslint-plugin';
import pluginImport from 'eslint-plugin-import';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import pluginHeader from 'eslint-plugin-header';
import pluginStylistic from '@stylistic/eslint-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

// Workaround, see https://github.com/Stuk/eslint-plugin-header/issues/57#issuecomment-2378485611
pluginHeader.rules.header.meta.schema = false;

export default [{
    ignores: [
        '**/node_modules/**/*',
        '**/bin/**/*',
        '**/bundle/**/*',
        '**/dist/**/*',
        '**/lib/**/*',
        '**/out/**/*',
        '**/resources/**/*',
        '**/production/**/*',
        '**/scripts/**/*',
        '**/packages/generator-langium/app/**/*',
        '**/packages/generator-langium/**/templates/**/*',
        '**/*env.d.ts',
        '**/esbuild.mjs',
        // WA: 'no-useless-escape': 'off' has no effect
        '**/examples/**/*.monarch.ts'
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
        import: pluginImport,
        'unused-imports': pluginUnusedImports,
        pluginHeader,
        '@stylistic': pluginStylistic
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
    // List of [ESLint rules](https://eslint.org/docs/rules/)
    rules: {
        // do not force arrow function parentheses
        'arrow-parens': ['off', 'as-needed'],
        // checks the correct use of super() in sub-classes
        'constructor-super': 'error',
        // obj.a instead of obj['a'] when possible
        'dot-notation': 'error',
        // ban '==', don't use 'smart' option!
        eqeqeq: 'error',
        // needs obj.hasOwnProperty(key) checks
        'guard-for-in': 'error',
        // new Error() instead of new Error
        'new-parens': 'error',
        // bitwise operators &, | can be confused with &&, ||
        'no-bitwise': 'error',
        // ECMAScript deprecated arguments.caller and arguments.callee
        'no-caller': 'error',
        // assignments if (a = '1') are error-prone
        'no-cond-assign': 'error',
        // disallow debugger; statements
        'no-debugger': 'error',
        // eval is considered unsafe
        'no-eval': 'error',
        // we need to have 'namespace' functions when using TS 'export ='
        'no-inner-declarations': 'off',
        // GOTO is only used in BASIC ;)
        'no-labels': 'error',
        // two or more empty lines need to be fused to one
        'no-multiple-empty-lines': ['error', {
            max: 1
        }],
        // there is no reason to wrap primitve values
        'no-new-wrappers': 'error',
        // only throw Error but no objects {}
        'no-throw-literal': 'error',
        // trim end of lines
        'no-trailing-spaces': 'error',
        // safe try/catch/finally behavior
        'no-unsafe-finally': 'error',
        // use const and let instead of var
        'no-var': 'error',
        // space in function decl: f() vs async () => {}
        'space-before-function-paren': ['error', {
            anonymous: 'never',
            asyncArrow: 'always',
            named: 'never'
        }],
        // Always use semicolons at end of statement
        semi: [2, 'always'],
        // Prefer single quotes
        quotes: [2, 'single', {
            avoidEscape: true
        }],
        // isNaN(i) Number.isNaN(i) instead of i === NaN
        'use-isnan': 'error',
        // Use MIT file header
        'pluginHeader/header': [2, 'block', [
            { pattern: 'MIT License|DO NOT EDIT MANUALLY!' }
        ]],
        'no-restricted-imports': ['error', {
            paths: [{
                name: 'vscode-jsonrpc',
                importNames: [ 'CancellationToken' ],
                message: 'Import "CancellationToken" via "Cancellation.CancellationToken" from "langium", or directly from "./utils/cancellation.ts" within Langium.'
            }, {
                name: 'vscode-jsonrpc/',
                importNames: [ 'CancellationToken'],
                message: 'Import "CancellationToken" via "Cancellation.CancellationToken" from "langium", or directly from "./utils/cancellation.ts" within Langium.'
            }],
            patterns: [ {
                group: [ 'vscode-jsonrpc' ],
                importNamePattern: '^(?!CancellationToken)',
                message: 'Don\'t import types or symbols from "vscode-jsonrpc" (package index), as that brings a large overhead in bundle size. Import from "vscode-jsonrpc/lib/common/...js" and add a // eslint-disable..., if really necessary.'
            }]
        }],
        // use @typescript-eslint/no-unused-vars instead
        'no-unused-vars': 'off',
        // Disallow unnecessary escape characters
        'no-useless-escape': 'off',

        // List of [@typescript-eslint rules](https://typescript-eslint.io/rules/)
        // Require that function overload signatures be consecutive
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        // Require consistently using either T[] or Array<T> for arrays
        '@typescript-eslint/array-type': ['error', {
            default: 'array-simple'
        }],
        // Disallow accidentally using the 'empty object' type
        '@typescript-eslint/no-empty-object-type': 'error',
        // Disallow explicit type declarations for variables or parameters initialized to a number, string, or boolean
        '@typescript-eslint/no-inferrable-types': 'off',
        // Disallow using the unsafe built-in Function type
        '@typescript-eslint/no-unsafe-function-type': 'error',
        // Disallow using confusing built-in primitive class wrappers
        '@typescript-eslint/no-wrapper-object-types': 'error',
        // Disallow the `any` type
        '@typescript-eslint/no-explicit-any': 'error',
        // Enforce valid definition of `new` and `constructor`
        '@typescript-eslint/no-misused-new': 'error',
        // Disallow TypeScript namespaces
        '@typescript-eslint/no-namespace': 'off',
        // Disallow non-null assertions using the ! postfix operator
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Require or disallow parameter properties in class constructors
        '@typescript-eslint/parameter-properties': 'off',
        // Disallow unused variables
        '@typescript-eslint/no-unused-vars': ['error', {
            caughtErrorsIgnorePattern: '^_',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
        }],
        // isallow require statements except in import statements
        '@typescript-eslint/no-var-requires': 'error',
        // Enforce the use of `for-of` loop over the standard `for` loop where possible
        '@typescript-eslint/prefer-for-of': 'error',
        // Require using `namespace` keyword over `module` keyword to declare custom TypeScript modules
        '@typescript-eslint/prefer-namespace-keyword': 'error',
        // Disallow certain triple slash directives in favor of ES6-style import declarations
        '@typescript-eslint/triple-slash-reference': 'error',
        // Disallow conditionals where the type is always truthy or always falsy
        '@typescript-eslint/no-unnecessary-condition': 'off',
        // Disallow unused expressions
        '@typescript-eslint/no-unused-expressions': 'off',
        // Enforce consistent usage of type imports
        '@typescript-eslint/consistent-type-imports': 'error',

        // List of [@stylistic rules](https://eslint.style/rules)
        // Enforce consistent indentation
        '@stylistic/indent': 'error',
        // Require consistent spacing around type annotations
        '@stylistic/type-annotation-spacing': 'error'
    }
}];
