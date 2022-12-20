/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { normalizeEOL } from 'langium';
import path from 'path';
import { createHelpers } from 'yeoman-test';

const defaultAnswers = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtension: '.hello',
    openWith: false
};

describe('Check yeoman generator works', () => {

    test('Should produce files', async () => {

        const context = createHelpers({}).run(path.join(__dirname, '../app'));
        context.targetDirectory = path.join(__dirname, '../../../examples/hello-world'); // generate in examples
        const targetRoot = path.join(__dirname, '../../../examples');
        context.cleanTestDirectory(true); // clean-up examples/hello-world
        await context
            .onGenerator(async (generator) => {
                // will generate into examples/hello-world instead of examples/hello-world/hello-world
                generator.destinationRoot(targetRoot, false);
            })
            .withAnswers(defaultAnswers)
            .withArguments('skip-install')
            .then((result) => {
                const generatedRoot = targetRoot + '/hello-world/';
                result.assertFile(generatedRoot + 'package.json');
                result.assertFileContent(generatedRoot + 'package.json', PACKAGE_JSON_EXPECTATION);
                result.assertFile(generatedRoot + '.vscode/tasks.json');
                result.assertFileContent(generatedRoot + '.vscode/tasks.json', TASKS_JSON_EXPECTATION);
                result.assertFile(generatedRoot + '.gitignore');
            }).finally(() => context.cleanup() /*clean-up*/ );
    }, 120_000);

});

const PACKAGE_JSON_EXPECTATION =
normalizeEOL(`{
    "name": "hello-world",
    "displayName": "hello-world",
    "description": "Please enter a brief description here",
    "version": "0.0.1",
    "engines": {
        "vscode": "^1.67.0"
    },
    "categories": [
        "Programming Languages"
    ],
    "contributes": {
        "languages": [{
            "id": "hello-world",
            "aliases": ["Hello World", "hello-world"],
            "extensions": [".hello"],
            "configuration": "./language-configuration.json"
        }],
        "grammars": [{
            "language": "hello-world",
            "scopeName": "source.hello-world",
            "path": "./syntaxes/hello-world.tmLanguage.json"
        }]
    },
    "activationEvents": [
        "onLanguage:hello-world"
    ],
    "files": [
        "bin",
        "out",
        "src"
    ],
    "bin": {
        "hello-world-cli": "./bin/cli"
    },
    "main": "./out/extension.js",
    "scripts": {
        "vscode:prepublish": "npm run build && npm run lint",
        "build": "tsc -b tsconfig.json",
        "watch": "tsc -b tsconfig.json --watch",
        "lint": "eslint src --ext ts",
        "langium:generate": "langium generate",
        "langium:watch": "langium generate --watch"
    },
    "dependencies": {
        "chevrotain": "~10.4.2",
        "chalk": "~4.1.2",
        "commander": "~10.0.0",
        "langium": "~1.1.0",
        "vscode-languageclient": "~8.0.2",
        "vscode-languageserver": "~8.0.2",
        "vscode-uri": "~3.0.7"
    },
    "devDependencies": {
        "@types/node": "~16.18.11",
        "@types/vscode": "~1.67.0",
        "@typescript-eslint/eslint-plugin": "~5.51.0",
        "@typescript-eslint/parser": "~5.51.0",
        "eslint": "~8.33.0",
        "langium-cli": "~1.1.0",
        "typescript": "~4.9.5"
    }
}`);

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