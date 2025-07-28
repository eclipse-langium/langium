# Command-line interface (CLI)

Check [this part](https://langium.org/docs/learn/minilogo/customizing_cli/) of the Langium Minilogo Tutorial as a useful guide to the CLI.

## What's in the folder?

- [package.json](./package.json) - The manifest file of your cli package.
- [tsconfig.src.json](./tsconfig.src.json) - The package specific TypeScript compiler configuration extending the [base config](../../tsconfig.json).
- [tsconfig.json](./tsconfig.json) - TypeScript compiler configuration options required for proper functionality of VSCode.
- [bin/cli.js](bin/cli/cli.js) - Script referenced in the [package.json](./package.json) and used to execute the command-line interface.
- [src/cli/main.ts](src/cli/main.ts) - The entry point of the command line interface (CLI) of your language.
- [src/cli/generator.ts](src/cli/generator.ts) - The code generator used by the CLI to write output files from DSL documents.
- [src/cli/util.ts](src/cli/util.ts) - Utility code for the CLI.

## Instructions

Run `node ./bin/cli` to see options for the CLI; `node ./bin/cli generate <file>` generates code for a given DSL file.
