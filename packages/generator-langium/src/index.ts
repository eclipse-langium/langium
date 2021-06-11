import Generator       from  'yeoman-generator';
import { StringUtils } from 'turbocommons-ts';

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
        this.sourceRoot(TEMPLATE_DIR);
    }

    async prompting(): Promise<void> {
        this.answers = await this.prompt([ 
          {
            type: "input",
            name: "extension_name",
            message: "Your extension name",
            default: EXTENSION_NAME
          },
          {
            type: "input",
            name: "language_id",
            message: "Your language identifier",
            default: LANGUAGE_ID,
            validate: function(input: string): boolean | string {
                if (/^[a-zA-Z_][\w]+$/.test(input.toString()))
                   return true;
                return "You entered not correct language-id. Try again.";
            }
          }
        ]);
    }

    private _toCamelCase(input: string): string {
        return StringUtils.formatCase(input, StringUtils.FORMAT_UPPER_CAMEL_CASE);
    }

    // FIX: types
    private _replaceInTemplate(answers: any, content: any): string {
        // FIX: regex can be replaced on parsers, but for what?
        return content.toString()
          .replace(new RegExp(EXTENSION_NAME, 'g'), answers.extension_name)
          .replace(new RegExp(LANGUAGE_ID, 'g'), answers.language_id)
          .replace(new RegExp(LANGUAGE_NAME, 'g'), this._toCamelCase(answers.language_id));
      }

    writing(): void {
        this.fs.copy(
          this.templatePath(EXTENSION_NAME, '.'),
          this.destinationPath(USER_DIR, this.answers.extension_name),
          { process: x => this._replaceInTemplate(this.answers, x) }
        );
    }

    end(): void {
        this.log("Extension name:", this.answers.extension_name);
        this.log("Language identifier:", this.answers.language_id);
        this.log("Have a nice coding :)");
    }
}

export = LangiumGenerator;
