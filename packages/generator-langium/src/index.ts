import yo = require("yeoman-generator");

class SimpleGenerator extends yo.generators.Base
{						
	constructor(args, options) {
        super(args, options);
        this.log("Constructor")              
    }
	
	public initialize() : void {
		this.log("initialize() : Your initialization methods (checking current project state, getting configs, etc)");		
	}
	
	public prompting() : void {
		this.log("prompting() : Where you prompt users for options (where you'd call this.prompt())");
	}
	
	public configuring() : void {
		this.log("configuring() : Saving configurations and configure the project (creating .editorconfig files and other metadata files)");
	}
	
	public writing() : void {
		this.log("writing() : Where you write the generator specific files (routes, controllers, etc)");
	}
			
	public install() : void {
		this.log("install() : Where installation are run (npm, bower)");	
	}

	public end() : void {
		this.log("end() : Called last, cleanup, say good bye, etc");
	}
		
	public SomeMethod() {
		this.log("SomeMethod");				
	}
	
	public AnotherMethod() {
		this.log("AnotherMethod");
	}
}

export = SimpleGenerator;




