import Generator from 'yeoman-generator';
import * as _ from 'lodash';

const TEMPLATE_DIR = 'langium-template';
const USER_DIR = 'app';

const OPEN = '<%= ';
const CLOSE = ' %>';

const EXTENSION_NAME = 'extension-name';
const LANGUAGE_NAME = 'LanguageName';
const FILE_EXTENSION = 'file-extension';
const LANGUAGE_ID = 'language-id';

interface Answers {
    extensionName: string;
    languageName: string;
    fileExtension: string;
    languageId: string;
}

class LangiumGenerator extends Generator {
    private answers: Answers;

    constructor(args: string | string[], options: Generator.GeneratorOptions) {
        super(args, options);
    }

    async prompting(): Promise<void> {
        this.answers = await this.prompt([
            {
                type: 'input',
                name: 'extensionName',
                message: 'Your extension name',
                default: EXTENSION_NAME,
            },
            {
                type: 'input',
                name: 'languageName',
                message: 'Name of your language',
                default: LANGUAGE_NAME,
                validate: (input: string): boolean | string =>
                    /^[a-zA-Z_][\w_ -]*$/.test(input)
                        ? true
                        : 'You entered not correct language name. Try again.',
            },
            {
                type: 'input',
                name: 'fileExtension',
                message: 'File extension of your language',
                default: FILE_EXTENSION,
                validate: (input: string): boolean | string =>
                    /^[a-z]*$/.test(input)
                        ? true
                        : 'Extension can contain only small letters. Try again.',
            },
        ]);
    }

    writing(): void {
        this.answers.languageName = _.upperFirst(
            _.camelCase(this.answers.languageName.replace(/[ -]+/g, '_'))
        );
        this.answers.languageId = _.snakeCase(this.answers.languageName);

        this.sourceRoot(TEMPLATE_DIR);
        ['.', '.vscode', '.eslintrc.json', '.vscodeignore'].forEach(
            (path: string) => {
                const replaceTemplateWords = (
                    answers: Answers,
                    content: Buffer
                ): string =>
                    [
                        [EXTENSION_NAME, answers.extensionName],
                        [FILE_EXTENSION, answers.fileExtension],
                        [LANGUAGE_ID, answers.languageId],
                        [LANGUAGE_NAME, answers.languageName],
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
                    path.replace(
                        new RegExp(LANGUAGE_ID, 'g'),
                        answers.languageId
                    );

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
            '..',
            this.answers.extensionName
        );

        this.spawnCommand('mv', [
            this.destinationPath(USER_DIR, this.answers.extensionName),
            extensionPath,
        ]);
        this.spawnCommand('npm', ['i', '--prefix', '../..']);
        this.spawnCommand('npm', [
            'run',
            '--prefix',
            extensionPath,
            'langium:generate',
        ]);
        this.spawnCommand('npm', ['run', '--prefix', extensionPath, 'build']);
    }
}

export = LangiumGenerator;
