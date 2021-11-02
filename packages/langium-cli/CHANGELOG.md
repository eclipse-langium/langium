# Change Log of `langium-cli`

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
