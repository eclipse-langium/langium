import Generator from  'yeoman-generator';

// FIX: get during running: "No change to package.json was detected. No package manager install will be executed."

class LangiumGenerator extends Generator
{
    // FIX: type of answers
    private answers: any;
    constructor(args: string | string[], options: Generator.GeneratorOptions) {
        super(args, options);
        
        // USE: template context
        this.sourceRoot("langium-template");
        this.log("Updated source root: ", this.sourceRoot());
     }

    initialize(): void {
        this.log('initialize()');
    }

    async prompting() {
        this.log('prompting()');
        this.answers = await this.prompt([ 
          {
            type: "input",
            name: "project_name",
            message: "Your project name",
            default: "langium-hello-world"
          }
        ]);
    }

    writing(): void {
        this.log("writing()", this.answers.project_name);
    }

    install(): void {
        this.log('install()');
    }

    end(): void {
        this.log("Have a nice coding :)");
    }
}

export = LangiumGenerator;
