# Change Log of `langium-sprotty`

## v4.4.2 (Nov. 2026)

* Dropped the update to `vscode-languageserver` version 11.0. The dependency is back to version `~10.1.0`. Version 4.5.0 will feature an update to the dependency instead.

## v4.4.1 (Nov. 2026)

* Diagnostic messages are now HTML-escaped in the hover popup, and multiple messages are no longer separated by stray commas ([#2258](https://github.com/eclipse-langium/langium/pull/2258)).
* Update `vscode-languageserver` to 11.0 ([#2249](https://github.com/eclipse-langium/langium/pull/2249)).

## v4.4.0 (Sep. 2026)

* Update the `langium` dependency to 4.4.0.
* Update `vscode-languageserver` to 10.1 ([#2184](https://github.com/eclipse-langium/langium/pull/2184)).

## v4.3.0 (Jun. 2026)

* Update the `langium` dependency to 4.3.0.
* Update `vscode-languageserver` to 10.0 as part of the LSP 3.18 update ([#2165](https://github.com/eclipse-langium/langium/pull/2165)).
* Declare `vscode-languageserver` as an explicit dependency ([#2154](https://github.com/eclipse-langium/langium/pull/2154)).

## v4.2.0 (Jan. 2026)

* Update the `langium` dependency to 4.2.0.

## v4.1.0 (Sep. 2025)

* Update the `langium` dependency to 4.1.0.

## v4.0.0 (Jul. 2025)

* Update the `langium` dependency to 4.0.0.

## v3.5.0 (Apr. 2025)

* Update the `langium` dependency to 3.5.0.

## v3.4.0 (Feb. 2025)

* Update the `langium` dependency to 3.4.0.

## v3.3.0 (Nov. 2024)

* Update the `langium` dependency to 3.3.0.

## v3.2.0 (Sep. 2024)

* Update the `langium` dependency to 3.2.0.
* The package is now marked as free of side effects (`"sideEffects": false`) to improve tree shaking ([#1643](https://github.com/eclipse-langium/langium/pull/1643)).

## v3.1.0 (Jun. 2024)

* Update the `langium` dependency to 3.1.0.

## v3.0.0 (Feb. 2024)

* Update the `langium` dependency to 3.0.0 and adapt to the new `langium/lsp` export ([#1258](https://github.com/eclipse-langium/langium/pull/1258)).
* Add selection synchronization between diagram and text, tracing of diagram elements to their source and diagnostic markers with hover popups ([#1312](https://github.com/eclipse-langium/langium/pull/1312)).
* Allow all 1.x versions of `sprotty-protocol` ([#1384](https://github.com/eclipse-langium/langium/pull/1384)).

## v2.1.0 (Nov. 2023)

* Update the `langium` dependency to 2.1.0.
* Update `sprotty-protocol` to 1.0.
* The fields of the `DefaultDiagramServerManager` are now `protected` instead of `private` ([#1211](https://github.com/eclipse-langium/langium/pull/1211)).

## v2.0.0 (Aug. 2023)

* Update the `langium` dependency to 2.0.0.

### EcmaScript Modules (ESM)

This package is now compiling to ESM only, refer to [this changelog entry](https://github.com/eclipse-langium/langium/blob/main/packages/langium/CHANGELOG.md#ecmascript-modules-esm)

## v1.3.0 (Aug. 2023)

* Update the `langium` dependency to 1.3.0.

## v1.2.0 (May. 2023)

* Update the `langium` dependency to 1.2.0.

## v1.1.0 (Feb. 2023)

* Update the `langium` dependency to 1.1.0.
* Update `sprotty-protocol` to 0.13.

## v1.0.0 (Dec. 2022)

* Update the `langium` dependency to 1.0.0.
* Update `sprotty-protocol` to 0.12.

## v0.5.0 (Oct. 2022)

* Update the `langium` dependency to 0.5.0.

## v0.4.0 (Jun. 2022)

* Update the `langium` dependency to 0.4.0.
* Remove the dependency on the Node.js `path` module to enable usage in the browser ([#530](https://github.com/eclipse-langium/langium/pull/530)).

## v0.3.0 (Mar. 2022)

Initial release of the `langium-sprotty` package. This package enables [Sprotty](https://github.com/eclipse-sprotty/sprotty)-powered diagrams generated from a Langium DSL ([#308](https://github.com/eclipse-langium/langium/pull/308)).
