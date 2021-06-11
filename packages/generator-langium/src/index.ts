import Generator      from 'yeoman-generator';
import *         as _ from 'lodash';

// FIX: get during running: "No change to package.json was detected. No package manager install will be executed."

const TEMPLATE_DIR   = 'langium-template';
const USER_DIR       = 'app';

const EXTENSION_NAME = 'extension-name';
const LANGUAGE_ID    = 'language-id';
const LANGUAGE_NAME  = 'LanguageName';

class LangiumGenerator extends Generator
{
    // FIX: type of answers
    private answers: any;

    constructor(args: string | string[], options: Generator.GeneratorOptions) {
        super(args, options);
    }

    async prompting(): Promise<void> {
        this.answers = await this.prompt([ 
          {
            type: "input",
            name: "extensionName",
            message: "Your extension name",
            default: EXTENSION_NAME
          },
          {
            type: "input",
            name: "languageId",
            message: "Your language identifier",
            default: LANGUAGE_ID,
            validate: function(input: string): boolean | string {
                if (/^[a-zA-Z_][\w-]*$/.test(input.toString()))
                   return true;
                return "You entered not correct language ID. Try again.";
            }
          }
        ]);
    }

    writing(): void {
        this.answers.languageName = _.upperFirst(_.camelCase(this.answers.languageId));

        this.sourceRoot(TEMPLATE_DIR);
        [".", ".vscode", ".eslintrc.json", ".vscodeignore"].map(path => {
          const replaceInTemplate = function(answers: any, content: Buffer): string {
            // FIX: regex can be replaced on parsers, but for what?
            return content.toString()
              .replace(new RegExp(EXTENSION_NAME, 'g'), answers.extensionName)
              .replace(new RegExp(LANGUAGE_ID, 'g'), answers.languageId)
              .replace(new RegExp(LANGUAGE_NAME, 'g'), answers.languageName);
          }  

          this.fs.copy(
            this.templatePath(path),
            this.destinationPath(USER_DIR, this.answers.extensionName, path),
            { process: (x: Buffer) => replaceInTemplate(this.answers, x) }
          );
        });
    }

    end(): void {
        this.log("Extension name:", this.answers.extensionName);
        this.log("Language identifier:", this.answers.languageId);
        this.log("Language name:", this.answers.languageName);
        this.log("Have a nice coding :)");
    }
}

export = LangiumGenerator;
