/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { normalizeEOL } from 'langium';
import path from 'path';
import { createHelpers } from 'yeoman-test';

const answersForCore = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtension: '.hello',
    includeVSCode: false,
    includeCLI: false,
    includeWeb: false,
    openWith: false
};

const answersForVSCode = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtension: '.hello',
    includeVSCode: true,
    includeCLI: false,
    includeWeb: false,
    openWith: false
};

const answersForCLI = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtension: '.hello',
    includeVSCode: false,
    includeCLI: true,
    includeWeb: false,
    openWith: false
};

const answersForWeb = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtension: '.hello',
    includeVSCode: false,
    includeCLI: false,
    includeWeb: true,
    openWith: false
};

describe('Check yeoman generator works', () => {

    test('Should produce files for Core', async () => {

        const context = createHelpers({}).run(path.join(__dirname, '../app'));
        context.targetDirectory = path.join(__dirname, '../../../examples/hello-world'); // generate in examples
        const targetRoot = path.join(__dirname, '../../../examples');
        context.cleanTestDirectory(true); // clean-up examples/hello-world
        await context
            .onGenerator(async (generator) => {
                // will generate into examples/hello-world instead of examples/hello-world/hello-world
                generator.destinationRoot(targetRoot, false);
            })
            .withAnswers(answersForCore)
            .withArguments('skip-install')
            .then((result) => {
                const files = [
                    targetRoot + '/hello-world/.eslintrc.json',
                    targetRoot + '/hello-world/.gitignore',
                    targetRoot + '/hello-world/langium-config.json',
                    targetRoot + '/hello-world/langium-quickstart.md',
                    targetRoot + '/hello-world/tsconfig.json',
                    targetRoot + '/hello-world/package.json',
                    targetRoot + '/hello-world/.vscode/extensions.json',
                    targetRoot + '/hello-world/.vscode/tasks.json',
                    targetRoot + '/hello-world/src/language/hello-world-module.ts',
                    targetRoot + '/hello-world/src/language/hello-world-validator.ts',
                    targetRoot + '/hello-world/src/language/hello-world.langium'
                ];
                result.assertFile(files);
                result.assertJsonFileContent(targetRoot + '/hello-world/package.json', PACKAGE_JSON_EXPECTATION);
                result.assertFileContent(targetRoot + '/hello-world/.vscode/tasks.json', TASKS_JSON_EXPECTATION);
            })
            .finally(() => context.cleanup() /*clean-up*/);
    }, 120_000);

    test ('Should produce files for VSCode', async () => {
        const context = createHelpers({}).run(path.join(__dirname, '../app'));
        context.targetDirectory = path.join(__dirname, '../../../examples/hello-world'); // generate in examples
        const targetRoot = path.join(__dirname, '../../../examples');
        context.cleanTestDirectory(true); // clean-up test-temp
        await context.onGenerator(generator => generator.destinationRoot(targetRoot, false))
            .withAnswers(answersForVSCode)
            .withArguments('skip-install')
            .then((result) => {
                const files = [
                    targetRoot + '/hello-world/.vscodeignore',
                    targetRoot + '/hello-world/language-configuration.json',
                    targetRoot + '/hello-world/.vscode/launch.json',
                    targetRoot + '/hello-world/src/language/main.ts',
                    targetRoot + '/hello-world/src/extension/main.ts'
                ];
                result.assertFile(files);
            })
            .finally(() => context.cleanup() /*clean-up*/);
    }, 120_000);

    test('Should produce files for CLI', async () => {
        const context = createHelpers({}).run(path.join(__dirname, '../app'));
        context.targetDirectory = path.join(__dirname, '../../../examples/hello-world'); // generate in examples
        const targetRoot = path.join(__dirname, '../../../examples');
        await context.onGenerator(generator => generator.destinationRoot(targetRoot, false))
            .withAnswers(answersForCLI)
            .withArguments('skip-install')
            .then((result) => {
                const files = [
                    targetRoot + '/hello-world/bin/cli',
                    targetRoot + '/hello-world/src/cli/cli-util.ts',
                    targetRoot + '/hello-world/src/cli/generator.ts',
                    targetRoot + '/hello-world/src/cli/main.ts'
                ];
                result.assertFile(files);
            })
            .finally(() => context.cleanup() /*clean-up*/);
    }, 120_000);

    test('Should produce files for web environment', async () => {
        const context = createHelpers({}).run(path.join(__dirname, '../app'));
        context.targetDirectory = path.join(__dirname, '../../../examples/hello-world'); // generate in examples
        const targetRoot = path.join(__dirname, '../../../examples');
        context.cleanTestDirectory(true);
        await context.onGenerator(generator => generator.destinationRoot(targetRoot, false))
            .withAnswers(answersForWeb)
            // .withArguments('skip-install')
            .then(result => {
                const files = [
                    targetRoot + '/hello-world/langium-config.json',
                    targetRoot + '/hello-world/tsconfig.json',
                    targetRoot + '/hello-world/tsconfig.monarch.json',
                    targetRoot + '/hello-world/src/language/main-browser.ts',
                    targetRoot + '/hello-world/src/static/index.html',
                    targetRoot + '/hello-world/src/static/setup.js',
                    targetRoot + '/hello-world/src/static/styles.css',
                    targetRoot + '/hello-world/src/web/app.ts',
                ];
                result.assertFile(files);
            })
            .finally(() => context.cleanup() /*clean-up*/);
    }, 120_000);

});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PACKAGE_JSON_EXPECTATION: Record<string, any> = {
    name: 'hello-world',
    description: 'Please enter a brief description here',
    version: '0.0.1',
    files: ['out', 'src'],
    scripts: {
        'build': 'tsc -b tsconfig.json',
        'watch': 'tsc -b tsconfig.json --watch',
        'lint': 'eslint src --ext ts',
        'langium:generate': 'langium generate',
        'langium:watch': 'langium generate --watch'
    },
    'dependencies': {
        'langium': '~1.1.0'
    },
    'devDependencies': {
        '@types/node': '~16.18.11',
        '@typescript-eslint/eslint-plugin': '~5.51.0',
        '@typescript-eslint/parser': '~5.51.0',
        'eslint': '~8.33.0',
        'langium-cli': '~1.1.0',
        'typescript': '~4.9.5'
    }
};

const TASKS_JSON_EXPECTATION =
normalizeEOL(`{
    // See https://go.microsoft.com/fwlink/?LinkId=733558
    // for the documentation about the tasks.json format
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Build hello-world",
            "command": "npm run langium:generate && npm run build",
            "type": "shell",
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "detail": "Langium: Generate grammar and build the hello-world language",
            "icon": {
                "color": "terminal.ansiGreen",
                "id": "server-process"
            }
        }
    ]
}
`);
