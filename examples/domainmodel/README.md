# Domain Model Example

## Generator CLI

The Domain Model Example features a generator that you can run via cli.

* Ensure the complete project was properly built, otherwise run `npm install` once in the root of the Langium project. That is enough, since we use npm workspaces to manage all of our npm projects as one monorepo.
* Run `npm run build` (again in the root directly) to actually generate the JavaScript code from the TypeScript sources.
* Use `node ./bin/cli` from the domainmodel directory to run the cli. Follow the instructions or use `node ./bin/cli generate <full-path-to-dmodel-file>`, e.g.

```bash
cd examples/domainmodel
node ./bin/cli generate example/blog.dmodel
```

produces this result:

```
Java classes generated successfully: generated/blog
```

The generator produces a Java class for each Entity and setter-getter methods for each Feature.

You also can use `domainmodel-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.
* Run `npm install -g ./` from the domainmodel directory.
* Use `domainmodel-cli` to run the cli. Follow the instructions or use `domainmodel-cli generate <full-path-to-dmodel-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Domainmodel Extension" to launch a new VSCode instance including the extension for this language.
Afterwards, use the run configuration "Attach" to attach the debugger to the running language server.
