import Generator from  'yeoman-generator';

// FIX: get during running: "No change to package.json was detected. No package manager install will be executed."

class LangiumGenerator extends Generator
{
    // FIX: type of answers
    private answers: any;
    constructor(args: string | string[], options: Generator.GeneratorOptions) {
        super(args, options);
        
        // USE: template context
        // this.log("Source root", this.sourceRoot());
        this.sourceRoot("template-files");
        // this.log("Updated source root", this.sourceRoot());

        // USE: destination context
        // this.log("Destination root", this.destinationRoot());

        // USE: compose with another generator
        // this.composeWith(require.resolve('generator-code/generators/app'));
 
        // USE: arguments
        // this.argument("age", { type: Number, required: false });
        // const age = this.options.age;
        // if (age != undefined) {
        //   this.log(age);
        // }

        // USE: options
        // this.option("nice", { type: Boolean, alias: "n", description: "is weather nice?" });
        // const nice = this.options.nice ? "YES" : "NO";
        // this.log("Is option here?", nice);
     }

    initialize(): void {
        this.log('initialize()');

        // XXX
        // this.prompting().then(_ => {
        //     this.log("It's okay")
        // });
    }

    install(): void {
      this.log('install()');
      this.spawnCommand('npm', ['install', 'chevrotain']);
    }

    async prompting() {
        this.log('prompting()');
          this.answers = await this.prompt([ 
          {
            type: "input",
            name: "projName",
            message: "Your project name",
            default: "langium-hello-world",
            // USE: keep answer
            // store: true
          },
          // USE: confirmation
          // {
          //   type: "confirm",
          //   name: "cool",
          //   message: "Would you like to enable the Cool feature?"
          // }
        ]);
      }

    writing(): void {
        this.log("WRITING: app name", this.answers.projName);

        // USE: make files from the template directory
        this.fs.copyTpl(
          this.templatePath('index.html'),
          this.destinationPath(this.answers.projName, 'index.html'),
            { title: 'Templating with Yeoman' }
        );  
    }

    // install(): void {
    //     this.log('install() : Where installation are run (npm, bower)');
    // }

    // end(): void {
    //     this.log('end() : Called last, cleanup, say good bye, etc');
    // }
}

export = LangiumGenerator;
