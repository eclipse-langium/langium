# Change Log of `langium`

## v0.3.0 (Mar. 2022)

### Multi-Language Support

Langium now supports multiple languages running in the same language server ([#311](https://github.com/langium/langium/pull/311)). This works by splitting the dependency injection container in two sets of services: the _shared_ services and the _language-specific_ services. When an LSP request is received from the client, the `ServiceRegistry` is used to decide which language is responsible for a given document by looking at its file extension.

A grammar file can use declarations from other grammar files by importing them. This is useful for organizing large grammars and for using common grammar rules in multiple languages. Imports are written with a relative path similarly to TypeScript:
```
import './expressions';
```
This makes all declarations of the file `expressions.langium` available in the current grammar.

The `grammar` declaration at the beginning of a grammar file is now optional unless the file is used as entry point for the language ([#381](https://github.com/langium/langium/pull/381)).

### Type Declarations in the Grammar

Langium is able to infer TypeScript types from your grammar rules by looking at the property assignments, actions and rule calls. This is very useful for the initial development of your language syntax, supporting rapid prototyping. For more mature language projects, however, it is advisable to declare the AST types explicitly because a large part of your code base depends on it: type system, validation, code generator etc. We introduced a new syntax so you can declare types directly in the grammar language and use them in your grammar rules ([#406](https://github.com/langium/langium/pull/406)).

The syntax is very similar to TypeScript:
```
interface Entity {
   name: string
   superType?: @Entity
   features: Feature[]
}

type Symbol = Entity | PackageDeclaration | DataType | Feature
```
The `interface` form describes the properties of an AST node type. The `@` character used at the `superType` property above denotes a cross-reference to a node of type `Entity`. The `type` form creates _union types_, i.e. an alternative of other declared or inferred types. These are transferred almost identically to TypeScript, where they have [their usual meaning](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html).

Parser rules which use the `returns` directive to infer a new type should now use the `infers` keyword instead. Using `returns` is only valid for explicitly declared types ([#438](https://github.com/langium/langium/pull/438)). Actions need to add the `infer` keyword in front of the type if it is not explicitly declared.

### New Sprotty Integration

A new package `langium-sprotty` is available to enable [Sprotty](https://github.com/eclipse/sprotty)-powered diagrams generated from a Langium DSL ([#308](https://github.com/langium/langium/pull/308)). An example is presented [in this blog post](https://www.typefox.io/blog/langium-meets-sprotty-combining-text-and-diagrams-in-vs-code).

### Further Improvements

 * In addition to regular expressions, terminals now feature an [_extended backus-naur form_](https://langium.org/docs/grammar-language/#more-on-terminal-rules) that enables composition of terminal rules ([#288](https://github.com/langium/langium/pull/288)).
 * We no longer assume that a terminal rule named `ID` is present when a cross-reference is defined without an explicit token ([#341](https://github.com/langium/langium/pull/341)). Instead, we derive the terminal or data type rule to use for the cross-reference from an assignment to the `name` property in the referenced grammar rule. This is not always possible, so in certain cases the cross-reference token must be stated explicitly, which is enforced by a validation.
 * Added an API for [semantic token highlighting](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_semanticTokens) ([#345](https://github.com/langium/langium/pull/345)).
 * Implemented support for [guarded parser rules](https://langium.org/docs/grammar-language/#guarded-rules) ([#346](https://github.com/langium/langium/pull/346), [#422](https://github.com/langium/langium/pull/422)).
 * Added `$containerProperty` and `$containerIndex` properties to `AstNode`, enabling the inclusion of programmatically created documents in the index ([#354](https://github.com/langium/langium/pull/354)).
 * Added a new `WorkspaceManager` service to be overridden if you want to specialize where the source files are found or to add programmatic documents to the index ([#377](https://github.com/langium/langium/pull/377)).
 * Extracted file system access to a single service to minimize dependencies to Node.js ([#405](https://github.com/langium/langium/pull/405)). This will ease using Langium in a web browser.
 * Added ability to use a multi-mode lexer ([#398](https://github.com/langium/langium/pull/398)).

### Breaking Changes

 * The `hidden` keyword of the grammar language is now used as modifier for terminals instead of following the top-level grammar declaration ([#288](https://github.com/langium/langium/pull/288)).
   Instead of
   ```
   grammar Foo
   hidden(WS)

   terminal WS: /\s+/;
   ```
   you now write
   ```
   grammar Foo

   hidden terminal WS: /\s+/;
   ```
 * Introduced a new `entry` keyword to explicitly mark the entry rule of the parser ([#305](https://github.com/langium/langium/pull/305)). Previously the first grammar rule was assumed to be the entry rule.
 * Changed the syntax of cross-references in the grammar ([#306](https://github.com/langium/langium/pull/306)). Instead of `property=[Type|TOKEN]`, you now write `property=[Type:TOKEN]`.
 * Some dependency injection services were moved to the new _shared services_ container ([#311](https://github.com/langium/langium/pull/311)), especially the `LangiumDocuments` and `DocumentBuilder`.
 * Numerous breaking API improvements that cannot be all mentioned here. If you're unsure how to migrate your code, please ask in [Discussions](https://github.com/langium/langium/discussions).

---

## v0.2.0 (Nov. 2021)

### Cross-File Linking

Cross-references can now be resolved between files. This works by introducing an _indexing_ phase where exported symbols are gathered from each document and made available in the _global scope_ ([#172](https://github.com/langium/langium/pull/172)). The default implementation exports the top-level AST elements that have a `name` property (the elements directly contained by the root of the AST), but this can be customized. The `ScopeProvider` service used to resolve cross-references first looks into locally defined symbols (from the same document), and falls back to the global scope when there is no local matching symbol.

The language server listens for file changes and updates documents and their exported symbols whenever a modification is reported by the client ([#271](https://github.com/langium/langium/pull/271), [#278](https://github.com/langium/langium/pull/278)).

### Asynchronous Processing

All LSP message processing is now potentially asynchronous, which enables longer-running operations to be cancelled ([#244](https://github.com/langium/langium/pull/244), [#269](https://github.com/langium/langium/pull/269)). This works by calling the utility function `interruptAndCheck`, which uses [`setImmediate`](https://nodejs.org/docs/latest-v15.x/api/timers.html#timers_setimmediate_callback_args) to interrupt the current execution so other incoming messages can be processed, and throws the `OperationCanceled` symbol when cancellation is indicated.

This is particularly important for the `DocumentBuilder` service, which is used to update documents and the index when change notifications are received. Cancellation ensures that the language server does not do unnecessary work when the user is modifying a document in a large workspace.

### Interpreted Parser

The parser is no longer generated by `langium-cli`, but constructed in-memory when the Langium application starts ([#169](https://github.com/langium/langium/pull/169)). This works by interpreting the grammar and building the parser via [Chevrotain](https://chevrotain.io/docs/)'s API. As a result, the whole infrastructure could be greatly simplified and now allows more fine-grained control over the lexing and parsing steps.

### Further Improvements

 * Introduced a testing API that enables unit tests for LSP features of your language ([#179](https://github.com/langium/langium/pull/179)).
 * Added API and default implementation for more LSP features:
    * [Folding](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_foldingRange) ([#178](https://github.com/langium/langium/pull/178))
    * [Hover](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_hover) ([#182](https://github.com/langium/langium/pull/182))
    * [Code actions](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_codeAction) ([#190](https://github.com/langium/langium/pull/190))
    * [Renaming](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_rename) ([#191](https://github.com/langium/langium/pull/191))
 * Terminal rules for comments are automatically detected and considered in syntax highlighting and other features ([#247](https://github.com/langium/langium/pull/247)).
 * You can now override the default linking of cross-references and generate custom error messages ([#256](https://github.com/langium/langium/pull/256), [#274](https://github.com/langium/langium/pull/274)), for example to realize function overloading.

### Breaking Changes

 * The API for generating code was improved ([#122](https://github.com/langium/langium/pull/122)).
 * The `GrammarAccess` service was removed because it was used mainly by the discontinued generated parser ([#169](https://github.com/langium/langium/pull/169)).
 * We now use the URI object from `vscode-uri` instead of plain strings ([#221](https://github.com/langium/langium/pull/221)).
 * Enhanced `Stream` API and removed `ArrayLikeStream` ([#257](https://github.com/langium/langium/pull/257)).
