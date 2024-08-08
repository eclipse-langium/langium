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

const BASE_DIR = '../templates';
const PACKAGE_LANGUAGE = 'packages/language';
const PACKAGE_CLI = 'packages/cli';
const PACKAGE_WEB = 'packages/web';
const PACKAGE_EXTENSION = 'packages/extension';
const USER_DIR = '.';

const EXTENSION_NAME = /<%= extension-name %>/g;
const RAW_LANGUAGE_NAME = /<%= RawLanguageName %>/g;
const FILE_EXTENSION = /"?<%= file-extension %>"?/g;
const FILE_EXTENSION_GLOB = /<%= file-glob-extension %>/g;

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

/**
 * This is a sub-set of LangiumConfig from langium-cli.
 * We copy this to not introduce a dependency to langium-cli itself.
 */
export interface LangiumLanguageConfigSubset {
    id: string
    grammar: string
    fileExtensions?: string[]
    textMate?: {
        out: string
    }
    monarch?: {
        out: string
    }
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

        const templateCopyOptions: CopyOptions = {
            process: content => this._replaceTemplateWords(fileExtensionGlob, languageName, languageId, content),
            processDestinationPath: path => this._replaceTemplateNames(languageId, path)
        };

        const pathBase = path.join(__dirname, BASE_DIR);
        this.sourceRoot(pathBase);
        const mainPackageJson = this.fs.readJSON(path.join(this.sourceRoot(), 'package.json'));
        const tsConfigBuildJson = this.fs.readJSON(path.join(this.sourceRoot(), 'tsconfig.build.json'));

        const baseFiles = [
            '.eslintrc.json',
            'tsconfig.json',
            'tsconfig.build.json',
            'README.md',
            '.vscode'
        ];
        for (const path of baseFiles) {
            this.fs.copy(
                this.templatePath(path),
                this._extensionPath(path),
                templateCopyOptions
            );
        }
        // .gitignore files don't get published to npm, so we need to copy it under a different name
        this.fs.copy(this.templatePath('gitignore.txt'), this._extensionPath('.gitignore'));

        this.sourceRoot(path.join(__dirname, `${BASE_DIR}/${PACKAGE_LANGUAGE}`));
        const languageFiles = [
            'package.json',
            'README.md',
            'tsconfig.json',
            'tsconfig.src.json',
            'vitest.config.ts',
            'src',
        ];
        if (this.answers.includeTest) {
            languageFiles.push('tsconfig.test.json');
            languageFiles.push('test');
        }
        for (const path of languageFiles) {
            this.fs.copy(
                this.templatePath(path),
                this._extensionPath(`${PACKAGE_LANGUAGE}/${path}`),
                templateCopyOptions
            );
        }

        const langiumConfigJson = {
            projectName: languageName,
            languages: [{
                id: languageId,
                grammar: `src/${languageId}.langium`,
                fileExtensions: [ fileExtensionGlob ],
                textMate: {
                    out: `syntaxes/${languageId}.tmLanguage.json`
                }
            } as LangiumLanguageConfigSubset],
            out: 'src/generated'
        };

        let languageIndex = `export * from './${languageId}-module.js';
export * from './${languageId}-validator.js';
export * from './generated/ast.js';
export * from './generated/grammar.js';
export * from './generated/module.js';
`;

        if (this.answers.includeTest) {
            mainPackageJson.scripts.test = 'npm run --workspace packages/language test';

            // ensure reference is directly behind ./packages/language/tsconfig.src.json
            tsConfigBuildJson.references.push({ path: './packages/language/tsconfig.test.json' });

            const languagePackageJson = this.fs.readJSON(this._extensionPath('packages/language/package.json'));
            languagePackageJson.devDependencies.vitest = '~1.6.0';
            languagePackageJson.scripts.test = 'vitest run';
            this.fs.delete(this._extensionPath('packages/language/package.json'));
            this.fs.writeJSON(this._extensionPath('packages/language/package.json'), languagePackageJson, undefined, 4);

            const extensionsJson = this.fs.readJSON(this._extensionPath('.vscode/extensions.json'));
            extensionsJson.recommendations.push('vitest.explorer');
            this.fs.delete(this._extensionPath('.vscode/extensions.json'));
            this.fs.writeJSON(this._extensionPath('.vscode/extensions.json'), extensionsJson, undefined, 4);
        }

        if (this.answers.includeCLI) {
            this.sourceRoot(path.join(__dirname, `${BASE_DIR}/${PACKAGE_CLI}`));
            const cliFiles = [
                'package.json',
                'tsconfig.json',
                'README.md',
                'bin',
                'src'
            ];
            for (const path of cliFiles) {
                this.fs.copy(
                    this.templatePath(path),
                    this._extensionPath(`${PACKAGE_CLI}/${path}`),
                    templateCopyOptions
                );
            }
            mainPackageJson.workspaces.push('packages/cli');
            tsConfigBuildJson.references.push({ path: './packages/cli/tsconfig.json' });
        }

        if (this.answers.includeWeb) {
            this.sourceRoot(path.join(__dirname, `${BASE_DIR}/${PACKAGE_WEB}`));
            const webFiles = [
                'package.json',
                'language-configuration.json',
                'README.md',
                'tsconfig.json',
                'index.html',
                'vite.config.ts',
                'src',
                'static'
            ];
            for (const path of webFiles) {
                this.fs.copy(
                    this.templatePath(path),
                    this._extensionPath(`${PACKAGE_WEB}/${path}`),
                    templateCopyOptions
                );
            }
            mainPackageJson.workspaces.push('packages/web');
            tsConfigBuildJson.references.push({ path: './packages/web/tsconfig.json' });

            this.sourceRoot(path.join(__dirname, `${BASE_DIR}/${PACKAGE_LANGUAGE}`));
            langiumConfigJson.languages[0].monarch = {
                out: `src/syntaxes/${languageId}.monarch.ts`
            };

            languageIndex = languageIndex?.concat(`\nexport { default as monarchSyntax } from './syntaxes/${languageId}.monarch.js';`);
        }

        // Write language index.ts and langium-config.json after possible alteration from web inclusion
        this.fs.write(this._extensionPath('packages/language/src/index.ts'), languageIndex);
        this.fs.writeJSON(this._extensionPath('packages/language/langium-config.json'), langiumConfigJson, undefined, 4);

        if (this.answers.includeVSCode) {
            this.sourceRoot(path.join(__dirname, `${BASE_DIR}/${PACKAGE_EXTENSION}`));
            const extensionFiles = [
                '.vscodeignore',
                'esbuild.mjs',
                'langium-quickstart.md',
                'language-configuration.json',
                'package.json',
                'tsconfig.json',
                'src'
            ];
            for (const path of extensionFiles) {
                this.fs.copy(
                    this.templatePath(path),
                    this._extensionPath(`${PACKAGE_EXTENSION}/${path}`),
                    templateCopyOptions
                );
            }
            mainPackageJson.workspaces.push('packages/extension');
            tsConfigBuildJson.references.push({ path: './packages/extension/tsconfig.json' });
        }

        this.fs.writeJSON(this._extensionPath('.package.json'), mainPackageJson, undefined, 4);
        this.fs.move(this._extensionPath('.package.json'), this._extensionPath('package.json'), templateCopyOptions);

        this.fs.writeJSON(this._extensionPath('.tsconfig.build.json'), tsConfigBuildJson, undefined, 4);
        this.fs.move(this._extensionPath('.tsconfig.build.json'), this._extensionPath('tsconfig.build.json'), templateCopyOptions);
    }

    async install(): Promise<void> {
        const extensionPath = this._extensionPath();

        const opts = { cwd: extensionPath };
        if(!this.args.includes('skip-install')) {
            this.spawnSync('npm', ['install'], opts);
        }
        this.spawnSync('npm', ['run', 'langium:generate'], opts);
        if(!this.args.includes('skip-build')) {
            this.spawnSync('npm', ['run', 'build'], opts);
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

    _replaceTemplateWords(fileExtensionGlob: string, languageName: string, languageId: string, content: string | Buffer): string {
        return content.toString()
            .replace(EXTENSION_NAME, this.answers.extensionName)
            .replace(RAW_LANGUAGE_NAME, this.answers.rawLanguageName)
            .replace(FILE_EXTENSION, this.answers.fileExtensions)
            .replace(FILE_EXTENSION_GLOB, fileExtensionGlob)
            .replace(LANGUAGE_NAME, languageName)
            .replace(LANGUAGE_ID, languageId)
            .replace(NEWLINES, EOL);
    }

    _replaceTemplateNames(languageId: string, path: string): string {
        return path.replace(LANGUAGE_PATH_ID, languageId);
    }
}

export default LangiumGenerator;
