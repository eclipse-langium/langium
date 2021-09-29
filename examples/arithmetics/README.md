# Arithmetics Example

## Interpreter CLI

The Arithmetics Example features an interpreter that you can run via cli.

* Ensure the complete project was properly built, otherwise run `npm install` from the root of the Langium project.
* Use `node ./bin/cli` from the arithmetics directory to run the cli. Follow the instructions or use `node ./bin/cli eval <full-path-to-calc-file>`.

The interpreter calculates each Evaluation in the source file and prints the result.

You also can use `arithmetics-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.
* Run `npm install -g ./` from the arithmetics directory.
* Use `arithmetics-cli` or `arithmetics-cli eval <full-path-to-calc-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Arithmetics Extension" to launch a new VSCode instance including the extension for this language.
Use the run configuration "Attach" to attach the debugger.
