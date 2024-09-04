# Change Log of `langium-cli`

## v3.2.0 (Sep. 2024)

Fixed an `undefined` error on certain regexes in the monarch generator ([#1594](https://github.com/eclipse-langium/langium/pull/1594)).

## v3.1.0 (Jun. 2024)

Fixed string escaping for generated code ([#1537](https://github.com/eclipse-langium/langium/pull/1537), [#1514](https://github.com/eclipse-langium/langium/pull/1514)).

## v3.0.2 (Apr. 2024)

Exported the textmate syntax highlighting under `langium-cli/textmate`. This enables importing the highlighting code for the Langium playground.

## v3.0.1 (Feb. 2024)

Fixed a minor issue related to generated code for projects that don't use the `langium/lsp` import ([#1393](https://github.com/eclipse-langium/langium/pull/1393)).

## v3.0.0 (Feb. 2024)

Some adjustments of the generated code due to the LSP bundling changes in Langium. For further information, see [here](https://github.com/eclipse-langium/langium/blob/main/packages/langium/CHANGELOG.md#smaller-bundles-with-exports).

## v2.0.1 (Aug. 2023)

Fix a bug that prevented usage of the JS API of the CLI package ([#1160](https://github.com/eclipse-langium/langium/pull/1160)).

## v2.0.0 (Aug. 2023)

### EcmaScript Modules (ESM)

This package is now compiling to ESM only, refer to [this changelog entry](https://github.com/eclipse-langium/langium/blob/main/packages/langium/CHANGELOG.md#ecmascript-modules-esm)

### Breaking Changes

* The CLI now always uses the original `projectName` of the `langium-config.json` property for the generated type/object names. It no longer performs kebab-case transformation ([#1122](https://github.com/eclipse-langium/langium/pull/1122)).
* We've decided to remove generated `$container` type declarations for types where it isn't clear what the container types can be ([#1055](https://github.com/eclipse-langium/langium/pull/1055)).

## v1.3.0 (Aug. 2023)

### Railroad Syntax Diagrams

With the introduction of [`langium-railroad`](https://github.com/eclipse-langium/langium/tree/main/packages/langium-railroad), the CLI is now capable of generating railroad syntax diagrams for your language ([#1075](https://github.com/eclipse-langium/langium/pull/1075)).
To generate them to a file, use the following example config:

```json
{
    ...
    "languages": [{
        ...
        "railroad": {
            "out": "docs/syntax-diagram.html"
        }
    }],
    ...
}
```

> **Note**
> The vscode extension for Langium contributes the `Show Railroad Syntax Diagram` command to show this HTML in a webview.

### Generated Terminal Definitions

The generated `ast.ts` file will now also contain an object containing all regular expressions used by your grammar's terminal rules ([#1097](https://github.com/eclipse-langium/langium/pull/1097)).
This allows to more easily reuse those regular expressions in your code.

### General Improvements

* The CLI can now resolve grammar imports transitively ([#1113](https://github.com/eclipse-langium/langium/pull/1113)).
* A new `mode` configuration/argument can be used to improve bundle size of Langium projects ([#1077](https://github.com/eclipse-langium/langium/pull/1077)).
* Fixed an error in the way the CLI creates directories ([#1105](https://github.com/eclipse-langium/langium/pull/1105)).

## v1.2.1 (Jun. 2023)

* The generated code now performs split imports for runtime and compile time dependencies ([#1018](https://github.com/eclipse-langium/langium/pull/1018)).
* The new configuration field `importExtension` can be used to specify the file extension for generated imports ([#1072](https://github.com/eclipse-langium/langium/pull/1072)).

## v1.2.0 (May. 2023)

### Prism Generator

The Langium CLI now features a generator for the [prism syntax highlighter](https://prismjs.com/).
The syntax highlighting for the [Langium documentation](https://langium.org/docs/grammar-language/) is already making use of a generated prism.js file.

Enable the generator by adding it to your `langium-config.json` file:

```json
{
    ...
    "languages": [{
        ...
        "prism": {
            "out": "syntax/prism.js"
        }
    }],
    ...
}
```

### General Improvements

* Various improvements to the type generator/validator. ([#942](https://github.com/eclipse-langium/langium/pull/942), [#946](https://github.com/eclipse-langium/langium/pull/946), [#947](https://github.com/eclipse-langium/langium/pull/947), [#950](https://github.com/eclipse-langium/langium/pull/950), [#973](https://github.com/eclipse-langium/langium/pull/973), [#1003](https://github.com/eclipse-langium/langium/pull/1003))

---

## v1.1.0 (Feb. 2023)

* Various improvements to the generated AST types ([#845](https://github.com/eclipse-langium/langium/pull/845)).
* The `--watch` mode now also watches referenced grammars, not only those directly used in the langium config file ([#908](https://github.com/eclipse-langium/langium/pull/908)).

---

## v1.0.0 (Dec. 2022) 🎉

 * New command `extract-types` generates type declarations to be used in your grammar file ([#754](https://github.com/eclipse-langium/langium/pull/754)). This utility can be used to move from _inferred_ types to _declared_ types, which makes sense when your language project becomes more mature.
 * New reference format in JSON-serialized grammars ([#787](https://github.com/eclipse-langium/langium/pull/787)).
 * Adapted to version `1.0.0` of the Langium core library.

---

## v0.5.0 (Oct. 2022)

 * Added an option to generate syntax highlighting in the [Monarch format](https://microsoft.github.io/monaco-editor/monarch.html) ([#620](https://github.com/eclipse-langium/langium/pull/620)).
 * Adapted to version `0.5.0` of the Langium core library.

---

## v0.4.0 (Jun. 2022)

This release brings lots of bug fixes and is adapted to version `0.4.0` of the Langium core library.

---

## v0.3.0 (Mar. 2022)

### General Improvements

 * Added support for importing other grammar files to state explicitly which rules should be included in your grammar ([#311](https://github.com/eclipse-langium/langium/pull/311)).
 * Added support for explicit type declarations in the grammar ([#406](https://github.com/eclipse-langium/langium/pull/406)).
 * Improved generated TextMate syntax highlighting ([#289](https://github.com/eclipse-langium/langium/pull/289), [#293](https://github.com/eclipse-langium/langium/pull/293), [#312](https://github.com/eclipse-langium/langium/pull/312)).
 * Added support for case-insensitive parsing of keywords ([#316](https://github.com/eclipse-langium/langium/pull/316)).
 * When parser validation errors occur, the file path and line number of the corresponding grammar rule is printed out ([#372](https://github.com/eclipse-langium/langium/pull/372)).

### Breaking Changes

 * In order to support multiple languages running in the same language server, the Langium configuration format was changed ([#311](https://github.com/eclipse-langium/langium/pull/311)). It now looks like this:
   ```
   {
     "projectName": "Arithmetics",
     "languages": [{
       "id": "arithmetics",
       "grammar": "src/language-server/arithmetics.langium",
       "fileExtensions": [".calc"],
       "textMate": {
         "out": "syntaxes/arithmetics.tmLanguage.json"
       }
     }],
     "out": "src/language-server/generated"
   }
   ```
   The `languages` array accepts multiple language configurations, which are then all generated at once.

---

## v0.2.0 (Nov. 2021)

### General Improvements

 * We no longer generate code for the parser, but derive it from the serialized grammar instead ([#169](https://github.com/eclipse-langium/langium/pull/169)).
 * The target folder is deleted before new files are generated ([#180](https://github.com/eclipse-langium/langium/pull/180)). In case the target folder contains any files that are _not_ regenerated, the CLI shows a question before deleting anything.
 * The language configuration used by `langium-cli` is now read from a separate file `langium-config.json` by default ([#158](https://github.com/eclipse-langium/langium/pull/158)). Embedding it in `package.json` is still supported.
 * Added the [Chevrotain parser configuration](https://chevrotain.io/documentation/9_1_0/interfaces/IParserConfig.html) to the Langium configuration (`chevrotainParserConfig` property, [#248](https://github.com/eclipse-langium/langium/pull/248)). Among other things, this enables setting the [maximum lookahead](https://chevrotain.io/documentation/9_1_0/interfaces/IParserConfig.html#maxLookahead).
 * The parser validation of Chevrotain is run as part of `langium-cli` to provide early feedback ([#253](https://github.com/eclipse-langium/langium/pull/253)).
 * The JSON content of the grammar is written to a TypeScript file instead of a `.json` file, simplifiying the build process ([#142](https://github.com/eclipse-langium/langium/pull/142)).
 * Some of the language meta data (language id and file extensions) are generated so they are available at runtime ([#170](https://github.com/eclipse-langium/langium/pull/170)).

### Breaking Changes

 * The `extensions` field in the Langium configuration was renamed to `fileExtensions` ([#173](https://github.com/eclipse-langium/langium/pull/173)).
