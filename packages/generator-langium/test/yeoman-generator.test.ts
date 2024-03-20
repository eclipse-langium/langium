/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { normalizeEOL } from 'langium/generate';
import * as path from 'node:path';
import * as url from 'node:url';
import { describe, test } from 'vitest';
import type * as Generator from 'yeoman-generator';
import { createHelpers } from 'yeoman-test';
import type { Answers, LangiumGenerator, PostAnwers } from '../src/index.js';

const answersForCore: Answers & PostAnwers = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtensions: '.hello',
    includeVSCode: false,
    includeCLI: false,
    includeWeb: false,
    includeTest: false,
    openWith: false
};

describe('Check yeoman generator works', () => {
    const packageTestDir = url.fileURLToPath(new URL('.', import.meta.url));
    const moduleRoot = path.join(packageTestDir, '../app');

    const files = (targetRoot: string) => [
        targetRoot + '/.eslintrc.json',
        targetRoot + '/.gitignore',
        targetRoot + '/langium-config.json',
        targetRoot + '/langium-quickstart.md',
        targetRoot + '/tsconfig.json',
        targetRoot + '/package.json',
        targetRoot + '/.vscode/extensions.json',
        targetRoot + '/.vscode/tasks.json',
        targetRoot + '/src/language/hello-world-module.ts',
        targetRoot + '/src/language/hello-world-validator.ts',
        targetRoot + '/src/language/hello-world.langium'
    ];

    const testFiles = (targetRoot: string) => [
        targetRoot + '/tsconfig.src.json',
        targetRoot + '/test/parsing/parsing.test.ts',
        targetRoot + '/test/linking/linking.test.ts',
        targetRoot + '/test/validating/validating.test.ts',
    ];

    test('1 Should produce files for Core', async () => {

        const context = createHelpers({}).run(path.join(moduleRoot));

        // generate in examples
        const targetRoot = path.resolve(packageTestDir, '../../../examples');
        const extensionName = answersForCore.extensionName;

        // remove examples/hello-world (if existing) now and finally (don't delete everything else in examples)
        context.targetDirectory = path.resolve(targetRoot, extensionName);
        context.cleanTestDirectory(true);

        await context
            .withOptions(<Generator.BaseOptions>{
                // we need to explicitly tell the generator it's destinationRoot
                destinationRoot: targetRoot
            })
            .onTargetDirectory(workingDir => {
                // just for double checking
                console.log(`Generating into directory: ${workingDir}`);
            })
            .withAnswers(answersForCore)
            .withArguments('skip-install')
            .then((result) => {
                const projectRoot = targetRoot + '/' + extensionName;

                result.assertFile(files(projectRoot));
                result.assertNoFile(testFiles(projectRoot));

                result.assertJsonFileContent(projectRoot + '/package.json', PACKAGE_JSON_EXPECTATION);
                result.assertFileContent(projectRoot + '/.vscode/tasks.json', TASKS_JSON_EXPECTATION);
            }).finally(() => {
                context.cleanTestDirectory(true);
            });
        context.cleanTestDirectory(true); // clean-up examples/hello-world
    }, 120_000);

    test('2 Should produce files for Core & CLI & test', async () => {

        const context = createHelpers({}).run<LangiumGenerator>(path.join(moduleRoot));

        // generate in examples
        const targetRoot = path.resolve(packageTestDir, '../../../examples');
        const extensionName = 'hello-world';

        // remove examples/hello-world (if existing) now and finally (don't delete everything else in examples)
        context.targetDirectory = path.resolve(targetRoot, extensionName);
        context.cleanTestDirectory(true);

        await context
            .withOptions(<Generator.BaseOptions>{
                // we need to explicitly tell the generator it's destinationRoot
                destinationRoot: targetRoot
            })
            .onTargetDirectory(workingDir => {
                // just for double checking
                console.log(`Generating into directory: ${workingDir}`);
            })
            .withArguments('skip-install')
            .withAnswers( <Answers>{
                ...answersForCore,
                extensionName,
                includeCLI: true,
                includeTest: true
            }).then((result) => {
                const projectRoot = targetRoot + '/' + extensionName;
                result.assertJsonFileContent(projectRoot + '/package.json', {
                    ...PACKAGE_JSON_EXPECTATION,
                    files: [ 'bin', 'out', 'src' ],
                    scripts: {
                        ...PACKAGE_JSON_EXPECTATION.scripts,
                        build: PACKAGE_JSON_EXPECTATION.scripts.build.replace(/tsconfig.json/, 'tsconfig.src.json'),
                        watch: PACKAGE_JSON_EXPECTATION.scripts.watch.replace(/tsconfig.json/, 'tsconfig.src.json')
                    }
                });

                const returnVal = result.generator.spawnSync('npm', ['test'], {
                    cwd: result.generator._extensionPath()
                });

                result.assertTextEqual(String(returnVal.exitCode), '0');

            }).finally(() => {
                context.cleanTestDirectory(true);
            });
    }, 120_000);
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const langiumVersion = `~${require('../../langium/package.json').version}`;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const langiumCliVersion = `~${require('../../langium-cli/package.json').version}`;

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
        'langium': langiumVersion
    },
    'devDependencies': {
        '@types/node': '^18.0.0',
        '@typescript-eslint/eslint-plugin': '~7.3.1',
        '@typescript-eslint/parser': '~7.3.1',
        'eslint': '~8.57.0',
        'langium-cli': langiumCliVersion,
        'typescript': '~5.1.6'
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
