# State Machine Example

## Generator CLI

The State Machine Example features a generator that you can run via cli.

* Ensure the complete project was properly built, otherwise run `npm install` once in the root of the Langium project. That is enough, since we use npm workspaces to manage all of our npm projects as one monorepo.
* Run `npm run build` (again in the root directly) to actually generate the JavaScript code from the TypeScript sources.
* Use `node ./bin/cli` from the statemachine directory to run the cli. Follow the instructions or use `node ./bin/cli generate <full-path-to-statemachine-file>`, e.g.

```bash
cd examples/statemachine
node ./bin/cli generate example/trafficlight.statemachine
```

produces this result:

```
C++ code generated successfully: generated/trafficlight.cpp
```

The generator produces a C++ cli to walk over the statemachine's states.

* Run `gcc <full-path-to-generated-cpp-cli> -lstdc++ -o cli` to get the executable file `cli.o`.
* Use `./cli` to run the cli. Enter an event name to pass to the next state.

You also can use `statemachine-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.

* Run `npm install -g ./` from the statemachine directory.
* Use `statemachine-cli` to run the cli. Follow the instructions or use `statemachine-cli generate <full-path-to-statemachine-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Statemachine Extension" to launch a new VSCode instance including the extension for this language.
Afterwards, use the run configuration "Attach" to attach the debugger to the running language server.
