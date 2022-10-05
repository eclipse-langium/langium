# Change Log of `langium-cli`

## v0.5.0 (Oct. 2022)

 * Added an option to generate syntax highlighting in the [Monarch format](https://microsoft.github.io/monaco-editor/monarch.html) ([#620](https://github.com/langium/langium/pull/620)).
 * Adapted to version `0.5.0` of the Langium core library.

## v0.4.0 (Jun. 2022)

This release brings lots of bug fixes and is adapted to version `0.4.0` of the Langium core library.

---

## v0.3.0 (Mar. 2022)

### General Improvements

 * Added support for importing other grammar files to state explicitly which rules should be included in your grammar ([#311](https://github.com/langium/langium/pull/311)).
 * Added support for explicit type declarations in the grammar ([#406](https://github.com/langium/langium/pull/406)).
 * Improved generated TextMate syntax highlighting ([#289](https://github.com/langium/langium/pull/289), [#293](https://github.com/langium/langium/pull/293), [#312](https://github.com/langium/langium/pull/312)).
 * Added support for case-insensitive parsing of keywords ([#316](https://github.com/langium/langium/pull/316)).
 * When parser validation errors occur, the file path and line number of the corresponding grammar rule is printed out ([#372](https://github.com/langium/langium/pull/372)).

### Breaking Changes

 * In order to support multiple languages running in the same language server, the Langium configuration format was changed ([#311](https://github.com/langium/langium/pull/311)). It now looks like this:
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

 * We no longer generate code for the parser, but derive it from the serialized grammar instead ([#169](https://github.com/langium/langium/pull/169)).
 * The target folder is deleted before new files are generated ([#180](https://github.com/langium/langium/pull/180)). In case the target folder contains any files that are _not_ regenerated, the CLI shows a question before deleting anything.
 * The language configuration used by `langium-cli` is now read from a separate file `langium-config.json` by default ([#158](https://github.com/langium/langium/pull/158)). Embedding it in `package.json` is still supported.
 * Added the [Chevrotain parser configuration](https://chevrotain.io/documentation/9_1_0/interfaces/IParserConfig.html) to the Langium configuration (`chevrotainParserConfig` property, [#248](https://github.com/langium/langium/pull/248)). Among other things, this enables setting the [maximum lookahead](https://chevrotain.io/documentation/9_1_0/interfaces/IParserConfig.html#maxLookahead).
 * The parser validation of Chevrotain is run as part of `langium-cli` to provide early feedback ([#253](https://github.com/langium/langium/pull/253)).
 * The JSON content of the grammar is written to a TypeScript file instead of a `.json` file, simplifiying the build process ([#142](https://github.com/langium/langium/pull/142)).
 * Some of the language meta data (language id and file extensions) are generated so they are available at runtime ([#170](https://github.com/langium/langium/pull/170)).

### Breaking Changes

 * The `extensions` field in the Langium configuration was renamed to `fileExtensions` ([#173](https://github.com/langium/langium/pull/173)).
