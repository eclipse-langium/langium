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
import type { Answers, LangiumGenerator, PostAnwers } from 'generator-langium';

const answersForCore: Answers & PostAnwers = {
    extensionName: 'hello-world',
    rawLanguageName: 'Hello World',
    fileExtensions: '.hello',
    includeVSCode: false,
    includeCLI: false,
    includeExampleProject: false,
    includeTest: false,
    openWith: false,
    entryName: 'Model'
};

describe('Check yeoman generator works', () => {
    const packageTestDir = url.fileURLToPath(new URL('.', import.meta.url));
    const moduleRoot = path.join(packageTestDir, '../app');

    const files = (targetRoot: string) => [
        targetRoot + '/.gitignore',
        targetRoot + '/tsconfig.build.json',
        targetRoot + '/tsconfig.json',
        targetRoot + '/package.json',
        targetRoot + '/README.md',
        targetRoot + '/.vscode/extensions.json',
        targetRoot + '/.vscode/launch.json',
        targetRoot + '/.vscode/tasks.json',
        targetRoot + '/packages/language/README.md',
        targetRoot + '/packages/language/src/hello-world-module.ts',
        targetRoot + '/packages/language/src/hello-world-validator.ts',
        targetRoot + '/packages/language/src/hello-world.langium',
        targetRoot + '/packages/language/src/generated/ast.ts',
        targetRoot + '/packages/language/src/generated/grammar.ts',
        targetRoot + '/packages/language/src/generated/module.ts',
        targetRoot + '/packages/language/syntaxes/hello-world.tmLanguage.json',
        targetRoot + '/packages/language/langium-config.json'
    ];

    const filesTest = (targetRoot: string) => [
        targetRoot + '/packages/language/tsconfig.test.json',
        targetRoot + '/packages/language/test/linking.test.ts',
        targetRoot + '/packages/language/test/parsing.test.ts',
        targetRoot + '/packages/language/test/validating.test.ts'
    ];

    const filesCli = (targetRoot: string) => [
        targetRoot + '/packages/cli/bin/cli.js',
        targetRoot + '/packages/cli/src/util.ts',
        targetRoot + '/packages/cli/src/generator.ts',
        targetRoot + '/packages/cli/src/main.ts',
        targetRoot + '/packages/cli/README.md',
        targetRoot + '/packages/cli/package.json',
        targetRoot + '/packages/cli/tsconfig.json'
    ];

    const filesExtension = (targetRoot: string) => [
        targetRoot + '/packages/extension/src/extension/main.ts',
        targetRoot + '/packages/extension/src/language/main.ts',
        targetRoot + '/packages/extension/syntaxes/hello-world.tmLanguage.json',
        targetRoot + '/packages/extension/.vscodeignore',
        targetRoot + '/packages/extension/esbuild.mjs',
        targetRoot + '/packages/extension/langium-quickstart.md',
        targetRoot + '/packages/extension/language-configuration.json',
        targetRoot + '/packages/extension/package.json',
        targetRoot + '/packages/extension/tsconfig.json'
    ];

    test('1 Should produce files for workspace and language (no test)', async () => {
        const context = createHelpers({}).run(path.join(moduleRoot));

        // generate in examples
        const targetRoot = path.resolve(packageTestDir, './generator-tests/test1');
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
            // speed up tests by skipping install
            .withArguments('skip-install')
            // speed up tests by skipping build
            .withArguments('skip-build')
            .then((result) => {
                const projectRoot = targetRoot + '/' + extensionName;

                result.assertFile(files(projectRoot));
                result.assertNoFile(filesTest(projectRoot));

                result.assertJsonFileContent(projectRoot + '/package.json', PACKAGE_JSON_EXPECTATION);
                result.assertFileContent(projectRoot + '/.vscode/tasks.json', TASKS_JSON_EXPECTATION);
            }).finally(() => {
                // clean-up examples/generator-tests/test1/hello-world
                context.cleanTestDirectory(true);
            });
    }, 120_000);

    test('2 Should produce files for workspace and language (plus test) and cli', async () => {
        const context = createHelpers({}).run<LangiumGenerator>(path.join(moduleRoot));

        // generate in examples
        const targetRoot = path.resolve(packageTestDir, './generator-tests/test2');
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
            .withAnswers( <Answers>{
                ...answersForCore,
                extensionName,
                includeExampleProject: true,
                includeCLI: true,
                includeTest: true
            })
            .withArguments('use-local-langium')
            .then((result) => {
                const projectRoot = targetRoot + '/' + extensionName;

                result.assertFile(files(projectRoot));
                result.assertFile(filesTest(projectRoot));
                result.assertFile(filesCli(projectRoot));

                const packageJson = JSON.parse(JSON.stringify(PACKAGE_JSON_EXPECTATION));
                packageJson.workspaces.push('packages/cli');
                packageJson.scripts.test = 'npm run --workspace packages/language test';
                result.assertJsonFileContent(projectRoot + '/package.json', packageJson);
                result.assertJsonFileContent(projectRoot + '/packages/cli/package.json', PACKAGE_JSON_EXPECTATION_CLI);

                const returnVal = result.generator.spawnSync('npm', ['test'], {
                    cwd: result.generator._extensionPath()
                });

                result.assertTextEqual(String(returnVal.exitCode), '0');

            }).finally(() => {
                // clean-up examples/generator-tests/test2/hello-world
                context.cleanTestDirectory(true);
            });
    }, 120_000);

    test('3 Should produce files for workspace, language (no test), cli and extension', async () => {
        const context = createHelpers({}).run<LangiumGenerator>(path.join(moduleRoot));

        // generate in examples
        const targetRoot = path.resolve(packageTestDir, './generator-tests/test3');
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
            .withAnswers( <Answers>{
                ...answersForCore,
                extensionName,
                includeCLI: true,
                includeVSCode: true
            })
            .withArguments('use-local-langium')
            .then((result) => {
                const projectRoot = targetRoot + '/' + extensionName;

                result.assertFile(files(projectRoot));
                result.assertNoFile(filesTest(projectRoot));
                result.assertFile(filesCli(projectRoot));
                result.assertFile(filesExtension(projectRoot));

                const packageJson = JSON.parse(JSON.stringify(PACKAGE_JSON_EXPECTATION));
                packageJson.workspaces.push('packages/cli');
                packageJson.workspaces.push('packages/extension');
                result.assertJsonFileContent(projectRoot + '/package.json', packageJson);
                result.assertJsonFileContent(projectRoot + '/packages/cli/package.json', PACKAGE_JSON_EXPECTATION_CLI);
                result.assertJsonFileContent(projectRoot + '/packages/extension/package.json', PACKAGE_JSON_EXPECTATION_EXTENSION);
            }).finally(() => {
                // clean-up examples/generator-tests/test3/hello-world
                context.cleanTestDirectory(true);
            });
    }, 150_000);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PACKAGE_JSON_EXPECTATION: Record<string, any> = {
    name: 'hello-world-workspace',
    description: 'Base workspace package',
    version: '0.0.1',
    type: 'module',
    private: true,
    scripts: {
        'clean': 'npm run clean --workspaces',
        'watch': 'tsc -b tsconfig.build.json --watch',
        'build': 'tsc -b tsconfig.build.json && npm run build --workspaces',
        'build:clean': 'npm run clean && npm run build',
        'langium:generate': 'npm run --workspace packages/language langium:generate',
        'langium:watch': 'npm run --workspace packages/language langium:watch'
    },
    'devDependencies': {
        '@types/node': '~20.17.48',
        'shx':  '~0.4.0',
        'typescript': '~5.8.3'
    },
    workspaces: [
        'packages/language'
    ]
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PACKAGE_JSON_EXPECTATION_CLI: Record<string, any> = {
    name: 'hello-world-cli',
    description: 'The cli specific package',
    version: '0.0.1',
    type: 'module',
    engines: {
        'node': '>=20.10.0',
        'npm': '>=10.2.3'
    },
    files: ['bin', 'out', 'src'],
    bin: {
        'hello-world-cli': './bin/cli.js'
    },
    scripts: {
        'clean': 'shx rm -fr *.tsbuildinfo out',
        'build': "echo 'No build step'",
        'build:clean': 'npm run clean && npm run build'
    },
    dependencies: {
        'hello-world-language': '0.0.1',
        'chalk': '~5.3.0',
        'commander': '~11.1.0'
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PACKAGE_JSON_EXPECTATION_EXTENSION: Record<string, any> = {
    name: 'vscode-hello-world',
    description: 'The extension specific package',
    version: '0.0.1',
    displayName: 'hello-world',
    engines: {
        vscode: '^1.67.0'
    },
    categories: [
        'Programming Languages'
    ],
    contributes: {
        languages: [{
            id: 'hello-world',
            aliases: ['Hello World', 'hello-world'],
            extensions: ['.hello'],
            configuration: './language-configuration.json'
        }],
        grammars: [{
            language: 'hello-world',
            scopeName: 'source.hello-world',
            path: 'syntaxes/hello-world.tmLanguage.json'
        }]
    },
    activationEvents: [
        'onLanguage:hello-world'
    ],
    main: './out/extension/main.cjs',
    scripts: {
        'clean': 'shx rm -fr *.tsbuildinfo out syntaxes',
        'vscode:prepublish': 'npm run build',
        'build:prepare': 'shx mkdir -p ./syntaxes/ && shx cp -f ../language/syntaxes/hello-world.tmLanguage.json ./syntaxes/hello-world.tmLanguage.json',
        'build': 'npm run build:prepare && tsc -b tsconfig.json && node esbuild.mjs',
        'build:clean': 'npm run clean && npm run build',
        'watch': 'npm run build:prepare && concurrently -n tsc,esbuild -c blue,yellow "tsc -b tsconfig.json --watch" "node esbuild.mjs --watch"'
    },
    dependencies: {
        'hello-world-language': '0.0.1',
        'vscode-languageclient': '~9.0.1',
        'vscode-languageserver': '~9.0.1'
    },
    devDependencies: {
        '@types/vscode': '~1.67.0',
        'concurrently': '~8.2.1',
        'esbuild': '~0.25.5'
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
