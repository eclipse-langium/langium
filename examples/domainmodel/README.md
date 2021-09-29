# Domain Model Example

## Generator CLI

The Domain Model Example features a generator that you can run via cli.

* Ensure the complete project was properly built, otherwise run `npm install` from the root of the Langium project.
* Use `node ./bin/cli` from the domainmodel directory to run the cli. Follow the instructions or use `node ./bin/cli generate <full-path-to-dmodel-file>`.

The generator produces a Java class for each Entity and setter-getter methods for each Feature.

You also can use `domainmodel-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.
* Run `npm install -g ./` from the domainmodel directory.
* Use `domainmodel-cli` to run the cli. Follow the instructions or use `domainmodel-cli generate <full-path-to-dmodel-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Domainmodel Extension" to launch a new VSCode instance including the extension for this language.
Use the run configuration "Attach" to attach the debugger.
