# Command-line interface (CLI)

Check [this part](https://langium.org/docs/learn/minilogo/customizing_cli/) of the Langium Minilogo Tutorial as a useful guide to the CLI.

## What's in the folder?

- [package.json](./package.json) - The manifest file of your cli package.
- [tsconfig.src.json](./tsconfig.src.json) - The package specific TypeScript compiler configuration extending the [base config](../../tsconfig.json)
- [tsconfig.json](./tsconfig.json) - TypeScript compiler configuration options required for proper functionality of VSCode.
- [src/cli/main.ts](src/cli/main.ts) - the entry point of the command line interface (CLI) of your language.
- [src/cli/generator.ts](src/cli/generator.ts) - the code generator used by the CLI to write output files from DSL documents.
- [src/cli/util.ts](src/cli/util.ts) - utility code for the CLI.

If you selected the test option as well, then you have the following for file as well:

- [tsconfig.test.json](./tsconfig.test.json) - The package specific TypeScript compiler configuration for the unit tests extending the [tsconfig.src.config](tsconfig.src.json)
- [test/linking.test.ts](test/linking.test.ts) - Unit tests checking linking.
- [test/parsing.test.ts](test/parsing.test.ts) - Unit tests regarding parsing.
- [test/validating.test.ts](test/validating.test.ts) - Unit tests regarding validation.
