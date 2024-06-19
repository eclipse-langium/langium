# Workspace overview

Depending on the selection during the project generation you will have one or more packages contained in the packages directory. Check the :

- [packages/language](./packages/language/README.md) is always available and contains the language definition.
- [packages/cli](./packages/cli/README.md) *Optional* Is only available if you chose to use the command-line interface.
- [packages/extension](./packages/extension/langium-quickstart.md) *Optional* Contains the VSCode extension if you chose to create it.
- [packages/web](./packages/web/README.md) *Optional* if selected contains the language server running in a web browser and a monaco-editor with language support similar to the onm from VSCode.

## What's in the folder?

- [.eslintrc.json](.eslintrc.json) - Configuration file for eslint
- [.gitignore](.gitignore) - Files ignored by git
- [package.json](./package.json) - The manifest file the main workspace package
- [tsconfig.json](./tsconfig.json) - The base TypeScript compiler configuration
- [tsconfig.build.json](./package.json) - Configuration used to build the complete source code.
