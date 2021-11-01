/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import Generator from 'yeoman-generator';
import _ from 'lodash';
import path from 'path';
import 'colors';

const TEMPLATE_DIR = '../langium-template';
const USER_DIR = '.';

const OPEN = '<%= ';
const CLOSE = ' %>';

const EXTENSION_NAME = 'extension-name';
const RAW_LANGUAGE_NAME = 'RawLanguageName';
const FILE_EXTENSION = 'file-extension';

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
                message: 'Your extension name:',
                default: 'hello-world',
            },
            {
                type: 'input',
                name: 'rawLanguageName',
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
                message:
                    'File extensions of your language, separated by commas:',
                default: '.hello',
                validate: (input: string): boolean | string =>
                    /^\.?\w+(\s*,\s*\.?\w+)*$/.test(input)
                        ? true
                        : 'The file extension can start with . and must contain only letters and digits. Extensions must be separated by commas.',
            },
        ]);
    }

    writing(): void {
        this.answers.fileExtensions =
            '[' +
            [
                ...new Set(
                    this.answers.fileExtensions
                        .split(/\s*,\s*/)
                        .map(
                            (fileExtension: string) =>
                                '".' +
                                _.trim(fileExtension).replace(/\./, '') +
                                '"'
                        )
                ),
            ].join(', ') +
            ']';

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
