# Integration of Langium and Sprotty

This package provides glue code for [Langium](https://langium.org) and [Sprotty](https://www.npmjs.com/package/sprotty). It includes the following features:

 * Generate diagram models from a Langium AST
 * Listen to document changes and update existing diagram models automatically
 * Hook into the JSON-RPC channel used by the language server

The counterpart of this integration is the [sprotty-vscode](https://www.npmjs.com/package/sprotty-vscode) package, which provides Sprotty diagrams embedded in VS Code webviews and is able to connect with the JSON-RPC stream of a chosen language.

## How to Use This

 1. Implement a diagram model generator by extending `LangiumDiagramGenerator`
 2. Add `SprottyDiagramServices` to the dependency injection module of your language and bind the `diagram.DiagramGenerator` service
 3. Add `DefaultSprottyModule` to the `inject` function that sets up your dependency injection container
 4. Call the `addDiagramHandler` function in your main code to hook into the JSON-RPC stream
