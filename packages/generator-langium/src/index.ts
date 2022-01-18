/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import Generator from 'yeoman-generator';
import _ from 'lodash';
import chalk from 'chalk';
import path from 'path';

const TEMPLATE_DIR = '../langium-template';
const USER_DIR = '.';

const OPEN = '<%= ';
const CLOSE = ' %>';

const EXTENSION_NAME = 'extension-name';
const RAW_LANGUAGE_NAME = 'RawLanguageName';
const FILE_EXTENSION = 'file-extension';
const FILE_EXTENSION_GLOB = 'file-glob-extension';

const LANGUAGE_NAME = 'LanguageName';
const LANGUAGE_ID = 'language-id';

interface Answers {
    extensionName: string;
    rawLanguageName: string;
    fileExtensions: string;
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

class LangiumGenerator extends Generator {
    private answers: Answers;

    constructor(args: string | string[], options: Generator.GeneratorOptions) {
        super(args, options);
    }

    async prompting(): Promise<void> {
        printLogo(this.log);
        this.answers = await this.prompt([
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
        ]);
    }

    writing(): void {
        const fileExtensions = [...new Set(this.answers.fileExtensions.split(',').map(ext => {
            return ext.trim().replace('.', '');
        }))];
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

        this.sourceRoot(path.join(__dirname, TEMPLATE_DIR));
        ['.', '.vscode', '.eslintrc.json', '.vscodeignore'].forEach(
            (path: string) => {
                const replaceTemplateWords = (
                    answers: Answers,
                    content: Buffer
                ): string =>
                    [
                        [EXTENSION_NAME, this.answers.extensionName],
                        [RAW_LANGUAGE_NAME, this.answers.rawLanguageName],
                        [FILE_EXTENSION, this.answers.fileExtensions],
                        [FILE_EXTENSION_GLOB, fileExtensionGlob],
                        [LANGUAGE_NAME, languageName],
                        [LANGUAGE_ID, languageId],
                    ].reduce(
                        (acc: string, [templateWord, userAnswer]) =>
                            acc.replace(
                                new RegExp(
                                    `${OPEN}${templateWord}${CLOSE}`,
                                    'g'
                                ),
                                userAnswer
                            ),
                        content.toString()
                    );

                const replaceTemplateNames = (
                    answers: Answers,
                    path: string
                ): string =>
                    path.replace(new RegExp(LANGUAGE_ID, 'g'), languageId);

                this.fs.copy(
                    this.templatePath(path),
                    this.destinationPath(
                        USER_DIR,
                        this.answers.extensionName,
                        path
                    ),
                    {
                        process: (content: Buffer) =>
                            replaceTemplateWords(this.answers, content),
                        processDestinationPath: (path: string) =>
                            replaceTemplateNames(this.answers, path),
                    }
                );
            }
        );
    }

    install(): void {
        const extensionPath = this.destinationPath(
            USER_DIR,
            this.answers.extensionName
        );

        const opts = { cwd: extensionPath };
        this.spawnCommandSync('npm', ['install'], opts);
        this.spawnCommandSync('npm', ['run', 'langium:generate'], opts);
        this.spawnCommandSync('npm', ['run', 'build'], opts);
    }
}

export = LangiumGenerator;
