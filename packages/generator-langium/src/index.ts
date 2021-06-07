import Generator from  'yeoman-generator';

class SimpleGenerator extends Generator
{
    constructor(args: string | string[], options: Generator.GeneratorOptions) {
        super(args, options);
        this.log('Constructor');
    }

    initialize(): void {
        this.log('initialize() : Your initialization methods (checking current project state, getting configs, etc)');
    }

    prompting(): void {
        this.log('prompting() : Where you prompt users for options (where you\'d call this.prompt())');
    }

    configuring(): void {
        this.log('configuring() : Saving configurations and configure the project (creating .editorconfig files and other metadata files)');
    }

    writing(): void {
        this.log('writing() : Where you write the generator specific files (routes, controllers, etc)');
    }

    install(): void {
        this.log('install() : Where installation are run (npm, bower)');
    }

    end(): void {
        this.log('end() : Called last, cleanup, say good bye, etc');
    }
}

export = SimpleGenerator;
