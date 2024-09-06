# Change Log of `langium`

## v3.2.0 (Sep. 2024)

### General Improvements

* Add indentation aware lexer and token builder implementations ([#1578](https://github.com/eclipse-langium/langium/pull/1578)).
* Add support for overriding semantic token types ([#1600](https://github.com/eclipse-langium/langium/pull/1600)).
* Improve support for non-vscode language clients on Windows ([#1660](https://github.com/eclipse-langium/langium/pull/1660)).
* Improve tree-shaking behavior of all Langium packages ([#1643](https://github.com/eclipse-langium/langium/pull/1643)).
* Make service containers readonly ([#1635](https://github.com/eclipse-langium/langium/pull/1635)).
* Improve class signatures of default service implementations ([#1604](https://github.com/eclipse-langium/langium/pull/1604)).

### Bug Fixes

* Call build phase callbacks for `Parsed` state ([#1572](https://github.com/eclipse-langium/langium/pull/1572)).
* Fix a few formatter related issues ([#1628](https://github.com/eclipse-langium/langium/pull/1628)).

## v3.1.2 (Jul. 2024)

* Fixes a minor issue in how we determine whether a grammar internal type is a primitive or an object type ([#1563](https://github.com/eclipse-langium/langium/pull/1563)).
* Introduced a new `onDocumentPhase` method for the `DocumentBuilder` interface and fixed stale references in ASTs ([#1566](https://github.com/eclipse-langium/langium/pull/1566)).
* Better handle empty names in the `DocumentSymbolProvider` ([#1565](https://github.com/eclipse-langium/langium/pull/1565)).

## v3.1.1 (Jun. 2024)

* Fixed an issue in a trigger-happy validation ([#1559](https://github.com/eclipse-langium/langium/pull/1559)).

## v3.1.0 (Jun. 2024)

### General Improvements

* Completion items now show the documentation of an element ([#1516](https://github.com/eclipse-langium/langium/pull/1516)).
* Better support for text document LSP operations ([#1474](https://github.com/eclipse-langium/langium/pull/1474)).
* Improve unknown file type handling in the language server ([#1455](https://github.com/eclipse-langium/langium/pull/1455), [#1492](https://github.com/eclipse-langium/langium/pull/1492)).
* Emit an event after configuration section updates ([#1445](https://github.com/eclipse-langium/langium/pull/1445)).
* Deleted files now have their diagnostics removed ([#1441](https://github.com/eclipse-langium/langium/pull/1441)).
* The parser can now start with an alternative entry rule ([#1407](https://github.com/eclipse-langium/langium/pull/1407)).

### Bug Fixes

* Fixed cyclic formatter behavior ([#1550](https://github.com/eclipse-langium/langium/pull/1550)).
* Fixed incorrect CST nodes after performing grammar actions ([#1547](https://github.com/eclipse-langium/langium/pull/1547)).
* Fixed a few `Stream` idempotency issues ([#1545](https://github.com/eclipse-langium/langium/pull/1545)).

### Breaking Changes

* The `ConfigurationProvider` interface needs to implement the `onConfigurationSectionUpdate` method ([#1445](https://github.com/eclipse-langium/langium/pull/1445)).
* The `ServiceRegistry` interface needs to implement the new `hasServices` method ([#1455](https://github.com/eclipse-langium/langium/pull/1455)).
* The `DefaultServiceRegistry#map` field has been deprecated. Please use the new `fileExtensionMap` field (together with `languageIdMap` instead).

## v3.0.0 (Feb. 2024)

### Smaller Bundles with Exports

Langium now offers dedicated exports to decrease bundle size.
This is especially relevant for adopters using Langium in browser apps or as webworker based language servers
where smaller bundle size is still pretty relevant.

All string generator related code has been moved to `langium/generate` ([#1287](https://github.com/eclipse-langium/langium/pull/1287)).

Everything related to the internals of the Langium grammar language has been moved to `langium/grammar` ([#1171](https://github.com/eclipse-langium/langium/pull/1171)).
Note that adopters generally shouldn't need to use this import at all.

All language server related functionality has been moved to `langium/lsp` ([#1258](https://github.com/eclipse-langium/langium/pull/1258)):
* This includes all services in the `lsp` object of the langium service instance and the `startLanguageServer` function.
* The `langium` import now only exposes the `LangiumCoreServices` service. 
Adopters using Langium to build a language server should continue using the known `LangiumServices`, which is now imported from `langium/lsp`.

### Asynchronous Parsing

The document lifecycle now supports async parsing ([#1352](https://github.com/eclipse-langium/langium/pull/1352)). This feature is disabled by default.
To enable it, adopters need to create a dedicated parser worker and pass the path of the worker to the new `WorkerThreadAsyncParser` class.
Take a look [at our test implementation](https://github.com/eclipse-langium/langium/blob/main/packages/langium/test/parser/worker-thread.js) to see how to use this yourself.

### General Improvements

* Various improvements to the document lifecycle ([#1286](https://github.com/eclipse-langium/langium/pull/1286), [#1304](https://github.com/eclipse-langium/langium/pull/1304), [#1330](https://github.com/eclipse-langium/langium/pull/1330)).
* Support for regex lookbehind in terminal tokens ([#1356](https://github.com/eclipse-langium/langium/pull/1356)).
* The workspace mutex now also supports read operations ([#1310](https://github.com/eclipse-langium/langium/pull/1310)).
* Default values on interface properties ([#1165](https://github.com/eclipse-langium/langium/pull/1165)).
* Utility functions are now wrapped in namespaces ([#1320](https://github.com/eclipse-langium/langium/pull/1320)).
* The language server now waits for the appropriate document builder phase before responding to requests ([#1334](https://github.com/eclipse-langium/langium/pull/1334)).
* The completion provider's cross-reference scope computation can be customized ([#1385](https://github.com/eclipse-langium/langium/pull/1385/)).
* Support for type hierarchy LSP requests added via a new TypeHierarchyProvider service ([#1278](https://github.com/eclipse-langium/langium/pull/1278))
* Removed explicit EOF token from the TokenProvider (could sometimes lead to issues) ([#1276](https://github.com/eclipse-langium/langium/pull/1276))
* Improved accuracy of the completion provider in some cases ([#1267](https://github.com/eclipse-langium/langium/pull/1267))
* Support references to other documents in the JsonSerializer ([#1254](https://github.com/eclipse-langium/langium/pull/1254))
* Fixed an issue that could lead to excessive time complexity when using Langium's built-in generation ([#1294](https://github.com/eclipse-langium/langium/pull/1294))
* Extended the yeoman generator for Langium to offer parsing, linking & validation test stubs with vitest ([#1298](https://github.com/eclipse-langium/langium/pull/1298))
* Allow referencing hidden terminals in terminal lookahead ([#1343](https://github.com/eclipse-langium/langium/pull/1343))
* Fixed an issue that could come up regarding cross-references that pointed to an instance of an inferred types [#1328](https://github.com/eclipse-langium/langium/pull/1328)

### Breaking Changes

If you're upgrading from v2 of Langium, there are a few breaking changes you should be aware of:

* All exports related to code generation have been moved from `langium` to `langium/generate`
* All LSP related services/functions have been moved to `langium/lsp`. This includes the types `LangiumServices` and `LangiumSharedServices`, as well as the function `startLanguageServer`.
* All code related to the internal workings of the grammar language have been moved to `langium/grammar`. 
* Utility functions related to AST/CST nodes, RegExp and some of the grammar are now exposed via namespaces to improve API surface area. They are now available under `AstUtils`, `CstUtils`, `GrammarUtils` and `RegExpUtils`. The names of the functions haven't changed.
* The `FileSystemProvider#readFileSync` method has been removed.
* The `LangiumDocuments#getOrCreateDocument` method now returns a `Promise<LangiumDocument>`. To use the `LangiumDocuments` in a sync context, use the `getDocument` method - optionally with the `createDocument` method - to get/create documents.
* The `DefaultCompletionProvider#filterCrossReference` method has been replaced by `getReferenceCandidates` allowing more general adjustments of the proposal identification.

## v2.1.0 (Nov. 2023)

### End-Of-File Parser Tokens

The grammar language now supports using end-of-file (EOF) tokens.
This is token can be useful in case your language is whitespace sensitive and you want to enforce that every statement ends on a newline.
Using EOF allows to replace the last newline token with the EOF token, removing the need for an additional empty line at the end of files. ([#1162](https://github.com/eclipse-langium/langium/pull/1162))

### General Improvements

* Allow JSDoc tag rendering customizations ([#1245](https://github.com/eclipse-langium/langium/pull/1245)).
* Updated the used `vscode-languageserver` version to 9.0 ([#1237](https://github.com/eclipse-langium/langium/pull/1237))
* Various improvements to the completion provider ([#1178](https://github.com/eclipse-langium/langium/pull/1178), [#1204](https://github.com/eclipse-langium/langium/pull/1204), [#1215](https://github.com/eclipse-langium/langium/pull/1215), [#1239](https://github.com/eclipse-langium/langium/pull/1239)).
* Prevent file name collisions during testing ([#1153](https://github.com/eclipse-langium/langium/pull/1153)).
* Added missing semantic token type `decorator` ([#1234](https://github.com/eclipse-langium/langium/pull/1234)).
* Emit `onUpdate` event on `DocumentBuilder#build` ([#1190](https://github.com/eclipse-langium/langium/pull/1190)).

## v2.0.1 (Aug. 2023)

Publish Langium's own grammar using minified JSON ([#1158](https://github.com/eclipse-langium/langium/pull/1158)).

## v2.0.0 (Aug. 2023)

### EcmaScript Modules (ESM)

Langium is now compiling to ESM instead of CommonJS (CJS).
CommonJS is the JavaScript convention introduced by Node.js and has historically been used in all Node.js based application.
With the introduction of ESM to modern versions of the Node.js runtime, more and more projects and libraries are making the move to ESM. Since a lot of our dependencies have moved on, we decided to do so as well.

While ESM based projects in Node.js can continue to import CJS code, CJS projects cannot (easily) import ESM code.
This is a **very important change** for adopters, as it prevents using Langium as-is in CJS projects.
This leaves us with a problem, as all vscode extensions need to run as CJS code.
Luckily, JavaScript bundlers such as `esbuild` are capable of transforming ESM code into CJS code.
Using a bundler for vscode extensions and language servers is heavily recommended anyway,
so we hope that adopters don't have much trouble upgrading to Langium 2.0.
You can find a small instruction manual on how to migrate TypeScript projects to ESM [here](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c#how-can-i-make-my-typescript-project-output-esm).

Note that the newest version of the yeoman generator contains a ready-to-use bundler configuration.
Adopters can use the generated project as a basis for upgrading to 2.0.
We also have [a guide available on our website](https://langium.org/guides/code-bundling/) that goes into more detail on this topic. If you have any questions on this topic, feel free to ask us on the [GitHub Discussions Board](https://github.com/eclipse-langium/langium/discussions).

### General Improvements

* The `DefaultDocumentBuilder` has been refactored to allow for more flexible and fine-grained validation behavior. ([#1094](https://github.com/eclipse-langium/langium/pull/1094)).

### Breaking Changes

* The `CodeLensProvider`, `DocumentLinkProvider` and `InlayHintProvider` services were moved from the shared LSP services container to the language specific services container. Additionally, their `resolve` methods have been removed ([#1107](https://github.com/eclipse-langium/langium/pull/1107)). 
* Deprecated a few properties available on CST nodes. They have been renamed and their old property names will be deleted in a future version ([#1131](https://github.com/eclipse-langium/langium/pull/1131)):
    * `CstNode#parent` -> `container`
    * `CstNode#feature` -> `grammarSource`
    * `CstNode#element` -> `astNode`
    * `CompositeCstNode#children` -> `content`
* The `IndexManager#getAffectedDocuments` has been changed to `isAffected`. Instead of returning a stream of all affected documents of a change, it now only returns whether a specified document is affected by the change of a set of documents ([#1094](https://github.com/eclipse-langium/langium/pull/1094)).
* The `BuildOptions#validationChecks` property has been replaced with `validation?: boolean | ValidationOptions` ([#1094](https://github.com/eclipse-langium/langium/pull/1094)).

---

## v1.3.0 (Aug. 2023)

### Regular Expression Flags

With [#1070](https://github.com/eclipse-langium/langium/pull/1070), the Langium grammar language now supports regular expression flags as part of terminal definitions:

1. `u` Enables unicode support for the specified terminal.
2. `i` Makes the terminal case-insensitive.
3. `s` Makes the wild character "`.`" match newlines as well.

### Cache Support

In order to build caches that are instantly invalidated on workspace or document changes,
Langium provides 2 new classes with [#1123](https://github.com/eclipse-langium/langium/pull/1123):

1. The `WorkspaceCache` is a cache that gets cleared whenever a file in the workspace is changed, removed or created.
2. The `DocumentCache` is a cache that stores information for specific documents. Whenever that document is modified in any way, the cache for that document is invalidated.

### General Improvements

* The `DefaultCompletionProvider` has received some improvements and should be even more accurate now ([#1106](https://github.com/eclipse-langium/langium/pull/1106), [#1138](https://github.com/eclipse-langium/langium/pull/1138)).
* Various performance improvements related to scoping and linking ([#1091](https://github.com/eclipse-langium/langium/pull/1091), [#1121](https://github.com/eclipse-langium/langium/pull/1121)).
* The new `CommentProvider` serves as a way to override how the comment of an AST node is computed ([#1095](https://github.com/eclipse-langium/langium/pull/1095)).
* The LSP `workspace/symbol` request is now resolved by the `WorkspaceSymbolProvider` ([#1100](https://github.com/eclipse-langium/langium/pull/1100)).
* Properties in guarded groups are now properly typed as optional ([#1116](https://github.com/eclipse-langium/langium/pull/1116)).
* Some generated regular expressions are now more accurate ([#1109](https://github.com/eclipse-langium/langium/pull/1109)).
* Generated language metadata is now being typed as `const` ([#1111](https://github.com/eclipse-langium/langium/pull/1111)).
* Fixed typing of the `root` property on CST nodes ([#1090](https://github.com/eclipse-langium/langium/pull/1090)).
* Parser error messages are now overridable in a service ([#1108](https://github.com/eclipse-langium/langium/pull/1108)).
* Prevent file name collisions during testing ([#1153](https://github.com/eclipse-langium/langium/pull/1153)).

---

## v1.2.1 (Jun. 2023)

Fixed a minor generator issue ([#1043](https://github.com/eclipse-langium/langium/pull/1043)).

## v1.2.0 (Apr. 2023)

### General Improvements

* Improvements to the language testing process ([#1002](https://github.com/eclipse-langium/langium/pull/1002), [#1008](https://github.com/eclipse-langium/langium/pull/1008))
* Fixed an issue related to cross references in the completion provider. ([#1004](https://github.com/eclipse-langium/langium/pull/1004))
* Fixed an issue related to document highlighting LSP requests for elements in other files. ([#1000](https://github.com/eclipse-langium/langium/pull/1000))

### Breaking Changes

* The `DefaultReferences` service has had a few protected methods removed. They are no longer necessary. ([#1000](https://github.com/eclipse-langium/langium/pull/1000))
* The `expectFunction` exported from `langium/test` is now deprecated and will be removed in a future version. It is no longer necessary to use, as Langium will simply use the `node:assert` package for testing. ([#1008](https://github.com/eclipse-langium/langium/pull/1008))

## v1.1.0 (Feb. 2023)

### JSDoc Support

Langium now features built-in [JSDoc](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) support.
The feature parses comment nodes that belong to a given AST node and returns structured information that can be used for further computations or printed to markdown for language server functionalities.

The recommended way to use the feature is to invoke the new [`DocumentationProviderService`](https://github.com/eclipse-langium/langium/blob/9493cdb10de0c9a79195485d5bd0208d20b55ec6/packages/langium/src/documentation/documentation-provider.ts).
For more complex use cases, you can call `parseJSDoc` directly.

### Generator Tracing

Extending upon the powerful code generator support added in the last release (see [here](#extended-code-generator-support)), we've added tracing capabilities.
Tracing allows developers to connect the generated statements with the position of their source statements.

This can be used to build [source maps](https://firefox-source-docs.mozilla.org/devtools-user/debugger/how_to/use_a_source_map/index.html) (known from the TypeScript compiler) or other source mappings formats.

Usage of the tracing API can be seen [here](https://github.com/eclipse-langium/langium/blob/9493cdb10de0c9a79195485d5bd0208d20b55ec6/packages/langium/test/generator/generation-tracing.test.ts).

### Other New Features

* Support for the language server inlay hint API ([#906](https://github.com/eclipse-langium/langium/pull/906)).
* Terminal definitions can now use positive and negative lookahead for more fine-grained lexer behavior ([#917](https://github.com/eclipse-langium/langium/pull/917)).

### General Improvements

* Improved default handling for escaped characters in strings ([#888](https://github.com/eclipse-langium/langium/pull/888)).
* Made the completion provider more resilient to errors in the input document ([#854](https://github.com/eclipse-langium/langium/pull/854)).
* Completion providers can now return server capability options (#[935](https://github.com/eclipse-langium/langium/pull/935)).

### Breaking Changes

* An internal grammar restructuring requires developers using Langium to regenerate their language if they're using explicit type declarations.
  We recommend to use `~` for Langium packages to prevent downstream users of your package to experience errors.

## v1.0.1 (Dec. 2022)

 * Add type validation with respect to the hierarchy ([#840](https://github.com/eclipse-langium/langium/pull/840))
 * Correctly sort types topologically ([#850](https://github.com/eclipse-langium/langium/pull/850))

## v1.0.0 (Dec. 2022) 🎉

### ALL(*) Lookahead Algorithm

Langium now uses the [_ALL(*)_ algorithm](https://www.typefox.io/blog/allstar-lookahead) to compute the lookahead for the [Chevrotain](https://chevrotain.io/) parser. This brings a huge improvement to the expressibility of Langium grammars: you no longer have to worry about how many tokens are required in the lookahead or how to order alternatives to ensure that all branches are considered.

You can still switch back to the _LL(k)_ algorithm that is shipped with Chevrotain by adding the following configuration to your `langium-config.json`. Here we set _k_ = 3, but you can increase that if necessary.

```
"chevrotainParserConfig": {
    "maxLookahead": 3
}
```

### Extended Code Generator Support

There is a new API to support generating code from your AST ([#825](https://github.com/eclipse-langium/langium/pull/825)). It works by constructing a tree structure (`GeneratorNode`) that gathers all the text snippets in its leafs. The tree can be serialized with the exported `toString` function.

The code generator infrastructure also brings two template string tag functions: `expandToString` removes leading whitespace to produce well-readable output code as a string, and `expandToNode` does the same while creating a `GeneratorNode` tree. A good example of the usefulness of these functions is in the [C++ code generator of the statemachine language](https://github.com/eclipse-langium/langium/blob/main/examples/statemachine/src/cli/generator.ts).

In a later release, we are going to add tracing support to generator trees. This will enable generating source maps, which are the basis for debugging in your language.

### Other New Features

 * Added `Lexer` service to enable customizing the lexer ([#721](https://github.com/eclipse-langium/langium/pull/721)).
 * Added support for [code lens](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_codeLens) ([#722](https://github.com/eclipse-langium/langium/pull/722)).
 * Added support for [go to declaration](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_declaration) ([#734](https://github.com/eclipse-langium/langium/pull/734)).

### General Improvements

 * Improved completion API and implemented fuzzy matching ([#739](https://github.com/eclipse-langium/langium/pull/739)).
 * Simplified programmatic construction of ASTs with references ([#774](https://github.com/eclipse-langium/langium/pull/774)).
 * New reference format in JSON serializer enables to export ASTs to other processes or applications ([#787](https://github.com/eclipse-langium/langium/pull/787)).
 * The `LangiumDocumentFactory` can now update the content of a `LangiumDocument` by reparsing its text ([#801](https://github.com/eclipse-langium/langium/pull/801)). This means that an instance of a document remains valid after a text change.

### Breaking Changes

 * Changed the generated `{LanguageName}AstType` (in `ast.ts`) from an enumeration of string types to an object type mapping AST type names to their type declarations ([#738](https://github.com/eclipse-langium/langium/pull/738)).
 * Changed the customization API of `DefaultCompletionProvider` ([#739](https://github.com/eclipse-langium/langium/pull/739)).
 * Reworked the code generator API ([#825](https://github.com/eclipse-langium/langium/pull/825)).

---

## v0.5.0 (Oct. 2022)

### New Features

 * Added support for [configuration changes](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#workspace_didChangeConfiguration) ([#519](https://github.com/eclipse-langium/langium/pull/519)). This can be used to synchronize the language server with VS Code settings.
 * Added support for [executing commands](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#workspace_executeCommand) ([#592](https://github.com/eclipse-langium/langium/pull/592)).
 * Added support for [signature help](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_signatureHelp) ([#612](https://github.com/eclipse-langium/langium/pull/612)).
 * Added support for [go to type definition](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_typeDefinition) ([#618](https://github.com/eclipse-langium/langium/pull/618)).
 * Added support for [go to implementation](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_implementation) ([#627](https://github.com/eclipse-langium/langium/pull/627)).
 * Added support for [call hierarchy](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#callHierarchy_incomingCalls) ([#643](https://github.com/eclipse-langium/langium/pull/643)).
 * Added support for [document links](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentLink) ([#688](https://github.com/eclipse-langium/langium/pull/688)).

### General Improvements

 * Improved handling of language server initialization and document changes ([#549](https://github.com/eclipse-langium/langium/pull/549), [#553](https://github.com/eclipse-langium/langium/pull/553), [#558](https://github.com/eclipse-langium/langium/pull/558), [#593](https://github.com/eclipse-langium/langium/pull/593)).
 * Refactored parts of the code so [Langium can run in the browser](https://www.typefox.io/blog/langium-web-browser) ([#568](https://github.com/eclipse-langium/langium/pull/568)).
 * Reimplemented the completion provider for more reliable results ([#623](https://github.com/eclipse-langium/langium/pull/623)).
 * Added a method `createScopeForNodes` to the `DefaultScopeProvider` class to be used in customizing subclasses ([#665](https://github.com/eclipse-langium/langium/pull/665)). The method can create a stream-based scope from a collection (array, stream etc.) of AST nodes.
 * The default completion service hides non-alphabetic keywords like `.`, `(`, `+` etc. ([#697](https://github.com/eclipse-langium/langium/pull/697)).

### Breaking Changes

 * Renamed "preprocessing" phase of the document builder to "scope computation" ([#622](https://github.com/eclipse-langium/langium/pull/622)). Accordingly, the `Processed` document state was renamed to `ComputedScopes`.
 * Changed signature of the `ScopeProvider` service: the method `getScope(node: AstNode, referenceId: string)` now has a single argument `getScope(context: ReferenceInfo)` ([#641](https://github.com/eclipse-langium/langium/pull/641)). If you have overridden that service, you need to update the signature; you can get the AST node via `context.container`.
 * Moved the `createDescriptions` method used for indexing from the `AstNodeDescriptionProvider` service to `ScopeComputation` and renamed it to `computeExports` ([#664](https://github.com/eclipse-langium/langium/pull/664)). If you have overridden that method, you need to move it to a different class accordingly.
 * Renamed the `computeScope` method of the `ScopeComputation` service to `computeLocalScopes` ([#664](https://github.com/eclipse-langium/langium/pull/664)). If you have overridden that method, you need to rename it accordingly.
 * Moved the `CompletionProvider` service declaration from the group `lsp.completion` to `lsp` ([#623](https://github.com/eclipse-langium/langium/pull/623)). This needs to be changed in your dependency injection module in case you have overridden that service.
 * Removed several declarations from the package index because they are meant to be used by the Langium Grammar language implementation ([#689](https://github.com/eclipse-langium/langium/pull/689), [#703](https://github.com/eclipse-langium/langium/pull/703)).
 * Definitions of the Langium Grammar language are wrapped in the `GrammarAST` namespace ([#703](https://github.com/eclipse-langium/langium/pull/703)).

---

## v0.4.0 (Jun. 2022)

### Formatting

Langium now features an API to configure formatting of your language ([#479](https://github.com/eclipse-langium/langium/pull/479)). To use this feature, you need to implement a subclass of `AbstractFormatter` and register it to the `lsp.Formatter` service:
```typescript
export class MyDSLFormatter extends AbstractFormatter {
    protected format(node: AstNode): void {
        ...
    }
}
```

The concrete formatting can be specified by first obtaining a node formatter and then choosing specific parts to format, like a keyword of the corresponding grammar rule. The chosen parts can be adjusted by appending or prepending white space:
```typescript
const formatter = this.getNodeFormatter(node);
const bracesClose = formatter.keyword('}');
bracesClose.prepend(Formatting.newLine());
```

See the [domain model formatter](https://github.com/eclipse-langium/langium/blob/main/examples/domainmodel/src/language-server/domain-model-formatter.ts) for a full example.

### Further Improvements

 * [Unordered groups](https://langium.org/docs/grammar-language/#unordered-groups) are supported in the grammar ([#522](https://github.com/eclipse-langium/langium/pull/522)).
 * `Date` and `bigint` data types are supported in the grammar ([#508](https://github.com/eclipse-langium/langium/pull/508)).
 * AST properties of type `boolean` are initialized to `false` even when they are not assigned a value during parsing ([#469](https://github.com/eclipse-langium/langium/pull/469)).
 * The JavaScript code compiled from the TypeScript sources is now compatible to ES2017 (previously ES2015), so `async` and `await` keywords are preserved ([#495](https://github.com/eclipse-langium/langium/pull/495)).
 * An API for testing validation checks is now available ([#506](https://github.com/eclipse-langium/langium/pull/506)).

---

## v0.3.0 (Mar. 2022)

### Multi-Language Support

Langium now supports multiple languages running in the same language server ([#311](https://github.com/eclipse-langium/langium/pull/311)). This works by splitting the dependency injection container in two sets of services: the _shared_ services and the _language-specific_ services. When an LSP request is received from the client, the `ServiceRegistry` is used to decide which language is responsible for a given document by looking at its file extension.

A grammar file can use declarations from other grammar files by importing them. This is useful for organizing large grammars and for using common grammar rules in multiple languages. Imports are written with a relative path similarly to TypeScript:
```
import './expressions';
```
This makes all declarations of the file `expressions.langium` available in the current grammar.

The `grammar` declaration at the beginning of a grammar file is now optional unless the file is used as entry point for the language ([#381](https://github.com/eclipse-langium/langium/pull/381)).

### Type Declarations in the Grammar

Langium is able to infer TypeScript types from your grammar rules by looking at the property assignments, actions and rule calls. This is very useful for the initial development of your language syntax, supporting rapid prototyping. For more mature language projects, however, it is advisable to declare the AST types explicitly because a large part of your code base depends on it: type system, validation, code generator etc. We introduced a new syntax so you can declare types directly in the grammar language and use them in your grammar rules ([#406](https://github.com/eclipse-langium/langium/pull/406)).

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

Parser rules which use the `returns` directive to infer a new type should now use the `infers` keyword instead. Using `returns` is only valid for explicitly declared types ([#438](https://github.com/eclipse-langium/langium/pull/438)). Actions need to add the `infer` keyword in front of the type if it is not explicitly declared.

### New Sprotty Integration

A new package `langium-sprotty` is available to enable [Sprotty](https://github.com/eclipse/sprotty)-powered diagrams generated from a Langium DSL ([#308](https://github.com/eclipse-langium/langium/pull/308)). An example is presented [in this blog post](https://www.typefox.io/blog/langium-meets-sprotty-combining-text-and-diagrams-in-vs-code).

### Further Improvements

 * In addition to regular expressions, terminals now feature an [_extended backus-naur form_](https://langium.org/docs/grammar-language/#more-on-terminal-rules) that enables composition of terminal rules ([#288](https://github.com/eclipse-langium/langium/pull/288)).
 * We no longer assume that a terminal rule named `ID` is present when a cross-reference is defined without an explicit token ([#341](https://github.com/eclipse-langium/langium/pull/341)). Instead, we derive the terminal or data type rule to use for the cross-reference from an assignment to the `name` property in the referenced grammar rule. This is not always possible, so in certain cases the cross-reference token must be stated explicitly, which is enforced by a validation.
 * Added an API for [semantic token highlighting](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_semanticTokens) ([#345](https://github.com/eclipse-langium/langium/pull/345)).
 * Implemented support for [guarded parser rules](https://langium.org/docs/grammar-language/#guarded-rules) ([#346](https://github.com/eclipse-langium/langium/pull/346), [#422](https://github.com/eclipse-langium/langium/pull/422)).
 * Added `$containerProperty` and `$containerIndex` properties to `AstNode`, enabling the inclusion of programmatically created documents in the index ([#354](https://github.com/eclipse-langium/langium/pull/354)).
 * Added a new `WorkspaceManager` service to be overridden if you want to specialize where the source files are found or to add programmatic documents to the index ([#377](https://github.com/eclipse-langium/langium/pull/377)).
 * Extracted file system access to a single service to minimize dependencies to Node.js ([#405](https://github.com/eclipse-langium/langium/pull/405)). This will ease using Langium in a web browser.
 * Added ability to use a multi-mode lexer ([#398](https://github.com/eclipse-langium/langium/pull/398)).

### Breaking Changes

 * The `hidden` keyword of the grammar language is now used as modifier for terminals instead of following the top-level grammar declaration ([#288](https://github.com/eclipse-langium/langium/pull/288)).
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
 * Introduced a new `entry` keyword to explicitly mark the entry rule of the parser ([#305](https://github.com/eclipse-langium/langium/pull/305)). Previously the first grammar rule was assumed to be the entry rule.
 * Changed the syntax of cross-references in the grammar ([#306](https://github.com/eclipse-langium/langium/pull/306)). Instead of `property=[Type|TOKEN]`, you now write `property=[Type:TOKEN]`.
 * Parser rules with a non-primitive `returns` type must be changed to use the `infers` keyword instead ([#438](https://github.com/eclipse-langium/langium/pull/438), [#445](https://github.com/eclipse-langium/langium/pull/445)), unless the type is declared explicitly.
 * Actions in parser rules need the `infer` keyword ([#438](https://github.com/eclipse-langium/langium/pull/438)), unless the type is declared explicitly.
 * Some dependency injection services were moved to the new _shared services_ container ([#311](https://github.com/eclipse-langium/langium/pull/311)), especially the `LangiumDocuments` and `DocumentBuilder`.
 * Numerous breaking API improvements that cannot be all mentioned here. If you're unsure how to migrate your code, please ask in [Discussions](https://github.com/eclipse-langium/langium/discussions).

### Migrating from v0.2.0

 1. Update `langium` and `langium-cli` to `^0.3.0` and update the Langium VS Code extension.
 2. Change `langium-config.json`:
    * Add a property `projectName` with a CamelCase version of your language name.
    * Rename the `languageId` property to `id`.
    * Move the following properties into the `languages` property, wrapped by an object and an array: `id`, `grammar`, `fileExtensions`, `textMate`.
      Example: `"languages": [{ "id": "hello-world", ... }]`
 3. Change your grammar file:
    * Remove the `hidden(...)` statement at the beginning of the grammar and prefix the respective terminal rules with the `hidden` keyword. Example: `hidden terminal WS: /\s+/;`
    * Add the `entry` keyword as prefix to the first parser rule.
    * Change the `|` character in every cross-reference to `:`. Example: `person=[Person:ID]`
    * In all parser rules that use the `returns` keyword with a non-primitive type, change that keyword to `infers`. Example: `Multiplication infers Expression: ...`
    * Add the `infer` keyword to all parser rule actions, just before the type name. Example: `{infer MyType}`
 4. Change the service creation function in your DI module file like this, replacing `Arithmetics` with your CamelCase language name:
    ```typescript
    export function createArithmeticsServices(context?: DefaultSharedModuleContext): {
        shared: LangiumSharedServices,
        arithmetics: ArithmeticsServices
    } {
        const shared = inject(
            createDefaultSharedModule(context),
            ArithmeticsGeneratedSharedModule
        );
        const arithmetics = inject(
            createDefaultModule({ shared }),
            ArithmeticsGeneratedModule,
            ArithmeticsModule
        );
        shared.ServiceRegistry.register(arithmetics);
        return { shared, arithmetics };
    }
    ```
 5. Pass the `shared` services to the `startLanguageServer` function in your language server's `main.ts`:
    ```typescript
    startLanguageServer(services.shared);
    ```
 6. Other selected API changes based on the Yeoman template:
    * In other places where you used the service creation function, e.g. the CLI, extract the language-specific service container from the returned object.
    * Where you use the `languageMetaData`, prefix that import with your CamelCase language name.
    * Access `LangiumDocuments`, `DocumentBuilder` and related services from `services.shared.workspace` instead of `services.documents`.
    * When passing a single document to `DocumentBuilder.build`, wrap it in an array.
    * There is no longer a `BuildResult` of `DocumentBuilder.build`; diagnostics (validation results) can be taken directly from the `LangiumDocument` instead.

---

## v0.2.0 (Nov. 2021)

### Cross-File Linking

Cross-references can now be resolved between files. This works by introducing an _indexing_ phase where exported symbols are gathered from each document and made available in the _global scope_ ([#172](https://github.com/eclipse-langium/langium/pull/172)). The default implementation exports the top-level AST elements that have a `name` property (the elements directly contained by the root of the AST), but this can be customized. The `ScopeProvider` service used to resolve cross-references first looks into locally defined symbols (from the same document), and falls back to the global scope when there is no local matching symbol.

The language server listens for file changes and updates documents and their exported symbols whenever a modification is reported by the client ([#271](https://github.com/eclipse-langium/langium/pull/271), [#278](https://github.com/eclipse-langium/langium/pull/278)).

### Asynchronous Processing

All LSP message processing is now potentially asynchronous, which enables longer-running operations to be cancelled ([#244](https://github.com/eclipse-langium/langium/pull/244), [#269](https://github.com/eclipse-langium/langium/pull/269)). This works by calling the utility function `interruptAndCheck`, which uses [`setImmediate`](https://nodejs.org/docs/latest-v15.x/api/timers.html#timers_setimmediate_callback_args) to interrupt the current execution so other incoming messages can be processed, and throws the `OperationCanceled` symbol when cancellation is indicated.

This is particularly important for the `DocumentBuilder` service, which is used to update documents and the index when change notifications are received. Cancellation ensures that the language server does not do unnecessary work when the user is modifying a document in a large workspace.

### Interpreted Parser

The parser is no longer generated by `langium-cli`, but constructed in-memory when the Langium application starts ([#169](https://github.com/eclipse-langium/langium/pull/169)). This works by interpreting the grammar and building the parser via [Chevrotain](https://chevrotain.io/docs/)'s API. As a result, the whole infrastructure could be greatly simplified and now allows more fine-grained control over the lexing and parsing steps.

### Further Improvements

 * Introduced a testing API that enables unit tests for LSP features of your language ([#179](https://github.com/eclipse-langium/langium/pull/179)).
 * Added API and default implementation for more LSP features:
    * [Folding](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_foldingRange) ([#178](https://github.com/eclipse-langium/langium/pull/178))
    * [Hover](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_hover) ([#182](https://github.com/eclipse-langium/langium/pull/182))
    * [Code actions](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_codeAction) ([#190](https://github.com/eclipse-langium/langium/pull/190))
    * [Renaming](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_rename) ([#191](https://github.com/eclipse-langium/langium/pull/191))
 * Terminal rules for comments are automatically detected and considered in syntax highlighting and other features ([#247](https://github.com/eclipse-langium/langium/pull/247)).
 * You can now override the default linking of cross-references and generate custom error messages ([#256](https://github.com/eclipse-langium/langium/pull/256), [#274](https://github.com/eclipse-langium/langium/pull/274)), for example to realize function overloading.

### Breaking Changes

 * The API for generating code was improved ([#122](https://github.com/eclipse-langium/langium/pull/122)).
 * The `GrammarAccess` service was removed because it was used mainly by the discontinued generated parser ([#169](https://github.com/eclipse-langium/langium/pull/169)).
 * We now use the URI object from `vscode-uri` instead of plain strings ([#221](https://github.com/eclipse-langium/langium/pull/221)).
 * Enhanced `Stream` API and removed `ArrayLikeStream` ([#257](https://github.com/eclipse-langium/langium/pull/257)).
