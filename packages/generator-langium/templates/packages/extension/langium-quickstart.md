# Langium VS Code Extension

Welcome to your Langium VSCode extension. This folder contains all necessary files for your language extension.

## What's in the folder?

- [package.json](./package.json) - The manifest file in which you declare your language support.
- [tsconfig.json](./tsconfig.json) - The packages specific TypeScript compiler configuration extending the [base config](../../tsconfig.json).
- [esbuild.mjs](./esbuild.mjs) - Configuration file for esbuild that is used to create the VSCode extension bundle.
- [language-configuration.json](./language-configuration.json) - the language configuration used in the VS Code editor, defining the tokens that are used for comments and brackets.
- [src/language/main.ts](./src/language/main.ts) - The entry point of the language server process.
- [src/extension/main.ts](./src/extension/main.ts) - The main code of the extension, which is responsible for launching a language server and client.

## Get up and running straight away

- Run `npm run langium:generate` to generate TypeScript code from the grammar definition.
- Run `npm run build` to compile all TypeScript code.
- Press `F5` to open a new window with your extension loaded.
- Create a new file with a file name suffix matching your language.
- Verify that syntax highlighting, validation, completion etc. are working as expected.

## Make changes

- Run `npm run watch` to have the TypeScript compiler run automatically after every change of the source files.
- Run `npm run langium:watch` to have the Langium generator run automatically after every change of the grammar declaration.
- You can relaunch the extension from the debug toolbar after making changes to the files listed above.
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Install your extension

- To start using your extension with VS Code, copy it into the `<user home>/.vscode/extensions` folder and restart Code.
- To share your extension with the world, read the [VS Code documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) about publishing an extension.

## To Go Further

Documentation about the Langium framework is available at <https://langium.org>
