# Command-line interface (CLI)

Check [this part](https://langium.org/docs/learn/minilogo/customizing_cli/) of the Langium Minilogo Tutorial as a useful guide to the CLI.

## What's in the folder?

- [package.json](./package.json) - The manifest file of your cli package.
- [tsconfig.json](./tsconfig.json) - The package specific TypeScript compiler configuration extending the [base config](../../tsconfig.json).
- [bin/cli.js](bin/cli.js) - Script referenced in the [package.json](./package.json) and used to execute the command-line interface.
- [src/main.ts](src/main.ts) - The entry point of the command line interface (CLI) of your language.
- [src/generator.ts](src/generator.ts) - The code generator used by the CLI to write output files from DSL documents.
- [src/util.ts](src/util.ts) - Utility code for the CLI.

## Instructions

Run `node ./bin/cli` to see options for the CLI; `node ./bin/cli generate <file>` generates code for a given DSL file.
