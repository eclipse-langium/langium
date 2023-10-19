/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import * as path from 'path';
import { createHelpers } from 'yeoman-test';

const currentUrl = new URL('../', import.meta.url).pathname;

const answersForCore = {
    extensionName: 'test-language',
    rawLanguageName: 'Test Language',
    fileExtension: '.test',
    includeVSCode: false,
    includeCLI: false,
    includeWeb: false,
    openWith: false
};

describe('Check yeoman generator works', () => {

    test('Should produce files for Core', async () => {
        const targetRoot = path.join(currentUrl, answersForCore.extensionName) + '/';
        const context = createHelpers({}).run(path.join(currentUrl, './app'));
        context.targetDirectory = targetRoot;
        context.cleanTestDirectory(true); // clean-up examples/test-language
        await context
            .withAnswers(answersForCore)
            .withArguments('skip-install')
            .then((result) => {
                const files = [
                    targetRoot + '.eslintrc.json',
                    targetRoot + '.gitignore',
                    targetRoot + 'langium-config.json',
                    targetRoot + 'langium-quickstart.md',
                    targetRoot + 'tsconfig.json',
                    targetRoot + 'package.json',
                    targetRoot + '.vscode/extensions.json',
                    targetRoot + '.vscode/tasks.json',
                    targetRoot + 'src/language/test-language-module.ts',
                    targetRoot + 'src/language/test-language-validator.ts',
                    targetRoot + 'src/language/test-language.langium'
                ];
                result.assertFile(files);
                result.assertJsonFileContent(targetRoot + 'package.json', PACKAGE_JSON_EXPECTATION);
                result.assertFileContent(targetRoot + '.vscode/tasks.json', TASKS_JSON_EXPECTATION);
            });
        context.cleanup();
    }, 120_000);

});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const langiumVersion = `~${require('../../langium/package.json').version}`;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const langiumCliVersion = `~${require('../../langium-cli/package.json').version}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PACKAGE_JSON_EXPECTATION: Record<string, any> = {
    name: 'test-language',
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
        'langium': langiumVersion
    },
    'devDependencies': {
        '@types/node': '~16.18.41',
        '@typescript-eslint/eslint-plugin': '~6.4.1',
        '@typescript-eslint/parser': '~6.4.1',
        'eslint': '~8.47.0',
        'langium-cli': langiumCliVersion,
        'typescript': '~5.1.6'
    }
};

const TASKS_JSON_EXPECTATION = `{
    // See https://go.microsoft.com/fwlink/?LinkId=733558
    // for the documentation about the tasks.json format
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Build test-language",
            "command": "npm run langium:generate && npm run build",
            "type": "shell",
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "detail": "Langium: Generate grammar and build the test-language language",
            "icon": {
                "color": "terminal.ansiGreen",
                "id": "server-process"
            }
        }
    ]
}
`;
