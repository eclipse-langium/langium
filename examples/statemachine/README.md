# State Machine Example

## Generator CLI

The State Machine Example features a generator that you can run via cli.

* Ensure the complete project was properly built, otherwise run `npm install` from the root of the Langium project.
* Run `npm install -g ./` from the statemachine directory.
* Use `statemachine-cli` to run the cli. Follow the instructions or use `statemachine-cli generate <full-path-to-statemachine-file>`.

The generator produces a C++ cli to walk over the statemachine's states.

* Run `gcc <full-path-to-generated-cpp-cli> -lstdc++ -o cli` to get the executable file `cli.o`.
* Use `./cli` to run the cli. Enter an event name to pass to the next state.

## VSCode Extension

Please use the VSCode run configuration "Run Statemachine Extension" to launch a new VSCode instance including the extension for this language.
Use the run configuration "Attach" to attach the debugger.
