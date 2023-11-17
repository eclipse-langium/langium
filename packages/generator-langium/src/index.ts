/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import Generator from 'yeoman-generator';
import type { CopyOptions } from 'mem-fs-editor';
import _ from 'lodash';
import chalk from 'chalk';
import * as path from 'node:path';
import which from 'which';
import { EOL } from 'node:os';
import * as url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const TEMPLATE_CORE_DIR = '../templates/core';
const TEMPLATE_VSCODE_DIR = '../templates/vscode';
const TEMPLATE_CLI_DIR = '../templates/cli';
const TEMPLATE_WEB_DIR = '../templates/web';
const TEMPLATE_TEST_DIR = '../templates/test';
const USER_DIR = '.';

const EXTENSION_NAME = /<%= extension-name %>/g;
const RAW_LANGUAGE_NAME = /<%= RawLanguageName %>/g;
const FILE_EXTENSION = /"?<%= file-extension %>"?/g;
const FILE_EXTENSION_GLOB = /<%= file-glob-extension %>/g;
const TSCONFIG_BASE_NAME = /<%= tsconfig %>/g;

const LANGUAGE_NAME = /<%= LanguageName %>/g;
const LANGUAGE_ID = /<%= language-id %>/g;
const LANGUAGE_PATH_ID = /language-id/g;

const NEWLINES = /\r?\n/g;

export interface Answers {
    extensionName: string;
    rawLanguageName: string;
    fileExtensions: string;
    includeVSCode: boolean;
    includeCLI: boolean;
    includeWeb: boolean;
    includeTest: boolean;
}

export interface PostAnwers {
    openWith: 'code' | false
}

function printLogo(log: (message: string) => void): void {
    log('\u001b[36m┌─────┐ ─┐');
    log('\u001b[36;1m┌───┐    │  ╶─╮ ┌─╮ ╭─╮ \u001b[36m╷ ╷ ╷ ┌─┬─╮');
    log('\u001b[36;1m│ ,´     │  ╭─┤ │ │ │ │ \u001b[36m│ │ │ │ │ │');
    log('\u001b[36;1m│╱       ╰─ ╰─┘ ╵ ╵ ╰─┤ \u001b[36m╵ ╰─╯ ╵ ╵ ╵');
    log('\u001b[36;1m`                   ╶─╯');
    log('');
}

function description(...d: string[]): string {
    return chalk.reset(chalk.dim(d.join(' ') + '\n')) + chalk.green('?');
}

export class LangiumGenerator extends Generator {
    private answers: Answers;

    constructor(args: string | string[], options: Record<string, unknown>) {
        super(args, options);
    }

    async prompting(): Promise<void> {
        printLogo(this.log);
        this.answers = await this.prompt<Answers>([
            {
                type: 'input',
                name: 'extensionName',
                prefix: description(
                    'Welcome to Langium!',
                    'This tool generates a VS Code extension with a "Hello World" language to get started quickly.',
                    'The extension name is an identifier used in the extension marketplace or package registry.'
                ),
                message: 'Your extension name:',
                default: 'hello-world',
            },
            {
                type: 'input',
                name: 'rawLanguageName',
                prefix: description(
                    'The language name is used to identify your language in VS Code.',
                    'Please provide a name to be shown in the UI.',
                    'CamelCase and kebab-case variants will be created and used in different parts of the extension and language server.'
                ),
                message: 'Your language name:',
                default: 'Hello World',
                validate: (input: string): boolean | string =>
                    /^[a-zA-Z].*$/.test(input)
                        ? true
                        : 'The language name must start with a letter.',
            },
            {
                type: 'input',
                name: 'fileExtensions',
                prefix: description(
                    'Source files of your language are identified by their file name extension.',
                    'You can specify multiple file extensions separated by commas.'
                ),
                message: 'File extensions:',
                default: '.hello',
                validate: (input: string): boolean | string =>
                    /^\.?\w+(\s*,\s*\.?\w+)*$/.test(input)
                        ? true
                        : 'A file extension can start with . and must contain only letters and digits. Extensions must be separated by commas.',
            },
            {
                type: 'confirm',
                name: 'includeVSCode',
                prefix: description(
                    'Your language can be run inside of a VSCode extension.'
                ),
                message: 'Include VSCode extension?',
                default: 'yes'
            },
            {
                type: 'confirm',
                name: 'includeCLI',
                prefix: description(
                    'You can add CLI to your language.'
                ),
                message: 'Include CLI?',
                default: 'yes'
            },
            {
                type: 'confirm',
                name: 'includeWeb',
                prefix: description(
                    'You can run the language server in your web browser.'
                ),
                message: 'Include Web worker?',
                default: 'yes'
            },
            {
                type: 'confirm',
                name: 'includeTest',
                prefix: description(
                    'You can add the setup for language tests using Vitest.'
                ),
                message: 'Include language tests?',
                default: 'yes'
            }
        ]);
    }

    writing(): void {
        const fileExtensions = Array.from(
            new Set(
                this.answers.fileExtensions
                    .split(',')
                    .map(ext => ext.replace(/\./g, '').trim()),
            )
        );
        this.answers.fileExtensions = `[${fileExtensions.map(ext => `".${ext}"`).join(', ')}]`;

        const fileExtensionGlob = fileExtensions.length > 1 ? `{${fileExtensions.join(',')}}` : fileExtensions[0];

        this.answers.rawLanguageName = this.answers.rawLanguageName.replace(
            /(?![\w| |\-|_])./g,
            ''
        );
        const languageName = _.upperFirst(
            _.camelCase(this.answers.rawLanguageName)
        );
        const languageId = _.kebabCase(this.answers.rawLanguageName);

        const referencedTsconfigBaseName = this.answers.includeTest ? 'tsconfig.src.json' : 'tsconfig.json';
        const templateCopyOptions: CopyOptions = {
            process: content => this._replaceTemplateWords(fileExtensionGlob, languageName, languageId, referencedTsconfigBaseName, content),
            processDestinationPath: path => this._replaceTemplateNames(languageId, path)
        };

        this.sourceRoot(path.join(__dirname, TEMPLATE_CORE_DIR));
        const pkgJson = this.fs.readJSON(path.join(this.sourceRoot(), '.package.json'));
        this.fs.extendJSON(this._extensionPath('package-template.json'), pkgJson, undefined, 4);

        for (const path of ['.', '.vscode', '.eslintrc.json']) {
            this.fs.copy(
                this.templatePath(path),
                this._extensionPath(path),
                templateCopyOptions
            );
        }

        // .gitignore files don't get published to npm, so we need to copy it under a different name
        this.fs.copy(this.templatePath('../gitignore.txt'), this._extensionPath('.gitignore'));

        if (this.answers.includeVSCode) {
            this.sourceRoot(path.join(__dirname, TEMPLATE_VSCODE_DIR));
            const pkgJson = this.fs.readJSON(path.join(this.sourceRoot(), '.package.json'));
            this.fs.extendJSON(this._extensionPath('package-template.json'), pkgJson, undefined, 4);
            this.sourceRoot(path.join(__dirname, TEMPLATE_VSCODE_DIR));
            for (const path of ['.', '.vscode', '.vscodeignore']) {
                this.fs.copy(
                    this.templatePath(path),
                    this._extensionPath(path),
                    templateCopyOptions
                );
            }
        }

        if (this.answers.includeCLI) {
            this.sourceRoot(path.join(__dirname, TEMPLATE_CLI_DIR));
            const pkgJson = this.fs.readJSON(path.join(this.sourceRoot(), '.package.json'));
            this.fs.extendJSON(this._extensionPath('package-template.json'),pkgJson, undefined, 4);
            for (const path of ['.']) {
                this.fs.copy(
                    this.templatePath(path),
                    this._extensionPath(path),
                    templateCopyOptions
                );
            }
        }

        if (this.answers.includeWeb) {
            this.sourceRoot(path.join(__dirname, TEMPLATE_WEB_DIR));
            const pkgJson = this.fs.readJSON(path.join(this.sourceRoot(), '.package.json'));
            this.fs.extendJSON(this._extensionPath('package-template.json'), pkgJson, undefined, 4);
            this.sourceRoot(path.join(__dirname, TEMPLATE_WEB_DIR));
            for (const path of ['.']) {
                this.fs.copy(
                    this.templatePath(path),
                    this._extensionPath(path),
                    templateCopyOptions
                );
            }
        }

        if (this.answers.includeTest) {
            this.sourceRoot(path.join(__dirname, TEMPLATE_TEST_DIR));

            this.fs.copy(
                this.templatePath('.'),
                this._extensionPath(),
                templateCopyOptions
            );

            // update the scripts section in the package.json to use 'tsconfig.src.json' for building
            const pkgJson = this.fs.readJSON(this.templatePath('.package.json'));
            this.fs.extendJSON(this._extensionPath('package-template.json'), pkgJson, undefined, 4);

            // update the 'includes' property in the existing 'tsconfig.json' and adds '"noEmit": true'
            const tsconfigJson = this.fs.readJSON(this.templatePath('.tsconfig.json'));
            this.fs.extendJSON(this._extensionPath('tsconfig.json'), tsconfigJson, undefined, 4);

            // the initial '.vscode/extensions.json' can't be extended as above, as it contains comments, which is tolerated by vscode,
            //  but not by `this.fs.extendJSON(...)`, so
            this.fs.copy(this.templatePath('.vscode-extensions.json'), this._extensionPath('.vscode/extensions.json'), templateCopyOptions);
        }

        this.fs.copy(
            this._extensionPath('package-template.json'),
            this._extensionPath('package.json'),
            templateCopyOptions
        );
        this.fs.delete(this._extensionPath('package-template.json'));
    }

    async install(): Promise<void> {
        const extensionPath = this._extensionPath();

        const opts = { cwd: extensionPath };
        if(!this.args.includes('skip-install')) {
            this.spawnSync('npm', ['install'], opts);
        }
        this.spawnSync('npm', ['run', 'langium:generate'], opts);

        if (this.answers.includeVSCode || this.answers.includeCLI) {
            this.spawnSync('npm', ['run', 'build'], opts);
        }

        if (this.answers.includeWeb) {
            this.spawnSync('npm', ['run', 'build:web'], opts);
        }
    }

    async end(): Promise<void> {
        const code = await which('code').catch(() => undefined);
        if (code) {
            const answer = await this.prompt<PostAnwers>({
                type: 'list',
                name: 'openWith',
                message: 'Do you want to open the new folder with Visual Studio Code?',
                choices: [
                    {
                        name: 'Open with `code`',
                        value: code

                    },
                    {
                        name: 'Skip',
                        value: false
                    }
                ]
            });
            if (answer?.openWith) {
                this.spawn(answer.openWith, [this._extensionPath()]);
            }
        }
    }

    _extensionPath(...path: string[]): string {
        return this.destinationPath(USER_DIR, this.answers.extensionName, ...path);
    }

    _replaceTemplateWords(fileExtensionGlob: string, languageName: string, languageId: string, tsconfigBaseName: string, content: string | Buffer): string {
        return content.toString()
            .replace(EXTENSION_NAME, this.answers.extensionName)
            .replace(RAW_LANGUAGE_NAME, this.answers.rawLanguageName)
            .replace(FILE_EXTENSION, this.answers.fileExtensions)
            .replace(FILE_EXTENSION_GLOB, fileExtensionGlob)
            .replace(LANGUAGE_NAME, languageName)
            .replace(LANGUAGE_ID, languageId)
            .replace(TSCONFIG_BASE_NAME, tsconfigBaseName)
            .replace(NEWLINES, EOL);
    }

    _replaceTemplateNames(languageId: string, path: string): string {
        return path.replace(LANGUAGE_PATH_ID, languageId);
    }
}

export default LangiumGenerator;
