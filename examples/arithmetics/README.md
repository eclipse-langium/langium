# Arithmetics Example

## Interpreter CLI

The Arithmetics Example features an interpreter that you can run via cli.

* Ensure the complete project was properly built, otherwise run `npm install` once in the root of the Langium project. That is enough, since we use npm workspaces to manage all of our npm projects as one monorepo.
* Run `npm run build` (again in the root directly) to actually generate the JavaScript code from the TypeScript sources.
* Use `node ./bin/cli` from the arithmetics directory to run the cli. Follow the instructions or use `node ./bin/cli eval <full-path-to-calc-file>`, e.g.

```bash
cd examples/arithmetics
node ./bin/cli eval example/example.calc
```

produces this result:

```
line 14: 2 * c ===> 16
line 15: b % 2 ===> 1
line 18: Root(D, 3) ===> 4.999999999999999
line 19: Root(64, 3) ===> 3.9999999999999996
line 20: Sqrt(81) ===> 9
```

The interpreter calculates each Evaluation in the source file and prints the result.

You also can use `arithmetics-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.

* Run `npm install -g ./` from the arithmetics directory.
* Use `arithmetics-cli` or `arithmetics-cli eval <full-path-to-calc-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Arithmetics Extension" to launch a new VSCode instance including the extension for this language.
Afterwards, use the run configuration "Attach" to attach the debugger to the running language server.
