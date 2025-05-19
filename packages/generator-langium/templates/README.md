# Workspace overview

Depending on the selection during the project generation you will have one or more packages contained in the packages directory.
Please check the specific projects here:

- [packages/language](./packages/language/README.md) This package is always available and contains the language definition.
- [packages/cli](./packages/cli/README.md) *Optional* Is only available if you chose to use the command-line interface.
- [packages/extension](./packages/extension/langium-quickstart.md) *Optional* Contains the VSCode extension if you chose to create it.

## What's in the folder?

Some file are contained in the root directory as well.

- [package.json](./package.json) - The manifest file the main workspace package
- [tsconfig.json](./tsconfig.json) - The base TypeScript compiler configuration
- [tsconfig.build.json](./package.json) - Configuration used to build the complete source code.
- [.gitignore](.gitignore) - Files ignored by git
