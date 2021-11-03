# Change Log of `generator-langium`

## v0.2.1 (Nov. 2021)

 * Fixed an outdated TypeScript reference in `src/cli/generator.ts` that led to a compile error.
 * Added `langium:watch` script to run the Langium CLI automatically when the grammar declaration is changed.
 * Updated `langium-quickstart.md` with information about the CLI.

## v0.2.0 (Nov. 2021)

### Added CLI Example

The generated package now includes a Node.js CLI that can be adapted to generate code from your language ([#175](https://github.com/langium/langium/pull/175)). The executable entry point is in the `bin` subfolder.

The initial generator example is based on the "Hello World" grammar; it generates JavaScript code that prints greetings to the console.

### Improved Debugging

 By setting the environment variable `DEBUG_BREAK` to a non-empty value, the language server is started with the `--inspect-brk` option of Node.js during debugging ([#227](https://github.com/langium/langium/pull/227)). When active, the language server execution is halted at the start of the entry point (`main.ts`), enabling to debug the initialization phase.
