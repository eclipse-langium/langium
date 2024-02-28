# Change Log of `generator-langium`

## v3.0.0 (Feb. 2024)

* Added templates of unit test stubs based on [Vitest](https://vitest.dev/) covering parsing, linking, and validation ([#1298](https://github.com/eclipse-langium/langium/pull/1298))

## v2.1.0 (Nov. 2023)

* Updated web template ([#1205](https://github.com/eclipse-langium/langium/pull/1205))
* Fixed the CLI generator for ESM ([#1201](https://github.com/eclipse-langium/langium/pull/1201))

## v2.0.0 (Aug. 2023)

* Added a bundle configuration using `esbuild` ([#1125](https://github.com/eclipse-langium/langium/pull/1125)).
* Configured the project as an ESM project to adapt to the changes in Langium ([#1125](https://github.com/eclipse-langium/langium/pull/1125)).

## v1.3.0 (Aug. 2023)

* Fixed a few syntax highlighting related issues ([#1064](https://github.com/eclipse-langium/langium/pull/1064), [#1079](https://github.com/eclipse-langium/langium/pull/1079)).

## v1.2.0 (May. 2023)

* Refactored the generator to enable multiple "environments". Devs will be asked whether they want a given environment in their project setup:
    * VSCode extension
    * Monaco web setup
    * CLI application setup

## v1.1.0 (Feb. 2023)

* Users that have vscode installed in the environment will be asked whether they want to open the generated project in vscode ([#911](https://github.com/eclipse-langium/langium/pull/911)).

## v1.0.0 (Dec. 2022) 🎉

 * Validation checks are registered in a plain function instead of a registry subclass ([#821](https://github.com/eclipse-langium/langium/pull/821)).

---

## v0.5.0 (Oct. 2022)

This release updates the generated dependencies to Langium version `0.5.0`.

## v0.4.0 (Jun. 2022)

This release updates the generated dependencies to Langium version `0.4.0`.

---

## v0.3.0 (Mar. 2022)

 * The generated project is adapted to the new structure supporting multiple languages ([#311](https://github.com/eclipse-langium/langium/pull/311)). This mainly affects the configuration format of the `langium` CLI and the separation of _shared services_ and _language-specific services_.
 * The generator now prints descriptions of the requested values ([#373](https://github.com/eclipse-langium/langium/pull/373)).
 * Added an `attach` launch config for debugging the language server ([#380](https://github.com/eclipse-langium/langium/pull/380)).

---

## v0.2.1 (Nov. 2021)

 * Fixed an outdated TypeScript reference in `src/cli/generator.ts` that led to a compile error.
 * Added `langium:watch` script to run the Langium CLI automatically when the grammar declaration is changed.
 * Updated `langium-quickstart.md` with information about the CLI.

## v0.2.0 (Nov. 2021)

### Added CLI Example

The generated package now includes a Node.js CLI that can be adapted to generate code from your language ([#175](https://github.com/eclipse-langium/langium/pull/175)). The executable entry point is in the `bin` subfolder.

The initial generator example is based on the "Hello World" grammar; it generates JavaScript code that prints greetings to the console.

### Improved Debugging

 By setting the environment variable `DEBUG_BREAK` to a non-empty value, the language server is started with the `--inspect-brk` option of Node.js during debugging ([#227](https://github.com/eclipse-langium/langium/pull/227)). When active, the language server execution is halted at the start of the entry point (`main.ts`), enabling to debug the initialization phase.
