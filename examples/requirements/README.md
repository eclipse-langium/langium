# Multi Language Example (Requirements Model and Test Model)

## Overview

This example allow to model Requirement and Tests Cases in two separate models (with separate languages). Test Cases can reference Requirements (cross language references).

We model Requirements in a simple Requirement Model (Requirements consist of and identifier and a requirement text):

```text
req ReqId001 "The cli-tool should allow to extract all test cases referencing a specific requirement"
req R1_tstID "A test identifier shall contain a number."
req RA_reqID "A requirement identifier shall contain a number."
req R3_reqCov "A requirement shall be covered by at least one test"
```

Test Cases have also an identifier and the references to the Requirements checked by the test.

## What does this example demonstrate

* How to integrate two languages to interact with each other: They use common rules (e.g., `ID` or `Contact`) and they have cross languages references (e.g. `Requirement` or `Environment`).
* How to setup these languages with their services and grammars (file layout).
* How to create cross language validations (are requirements covered by some tests?).
* How to create a cross language generator (coverage matrix).

## Language Design

Grammars:

* `common.langium`: common aspects used the main grammars.
* `requirements.langium`: requirements language (includes `common.langium`)
* `tests.langium`: requirements language (includes `common.langium` and `requirements.langium`, references `Requirement` elements from `requirements.langium`).

Modules and Services:

* `createRequirementsAndTestsLangServices` creates the full set of services used by the CLI and the language server.
* `requirements-lang-module.ts`: requirements service configuration
* `tests-lang-module.ts`: tests service configuration

Language configuration:

* `langium-config.json`: see [npm documentation on langium-cli](https://www.npmjs.com/package/langium-cli).
* `package.json`: `contributes` section, see: [visualstudio reference](https://code.visualstudio.com/api/references/contribution-points#contributes.languages).

CLI and tests:

* `extractDocuments` in `cli-utils.ts` is responsible to load a requirement model file (`*.req`) and all test model files (`*.tst`) located in the folder of the processed requirement file. This is required in order to process the requirement model which needs all associated test models in the workspace.

## Generator CLI

The Example features a generator that you can run via cli to process Requirement Model files. The outcome is a HTML table with a coverage matrix indicating which Test Cases test the Requirements of the file passed to the CLI.

* Ensure the complete project was properly built, otherwise run `npm install` from the root of the Langium project.
* Use `node ./bin/cli` from the requirements directory to run the cli. Follow the instructions or use `node ./bin/cli generate <full-path-to-req-file>`.

The generator produces an HTML file.

You also can use `requirements-and-tests-lang-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.

* Run `npm install -g ./` from the requirements-and-tests directory.
* Use `requirements-and-tests-lang-cli` to run the cli. Follow the instructions or use `requirements-and-tests-lang-cli generate <full-path-to-req-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Requirements and Tests Extension" to launch a new VSCode instance including the extension for this language.
Use the run configuration "Attach" to attach the debugger.

## Validators

* A test identifier shall contain a number.
* A requirement identifier shall contain a number.
* A requirement shall be covered by at least one test (note: when updating the test model, the requirement is not rechecked automatically: this point is hard to validate locally because we need to scan the whole workspace to find tests that cover a requirement. Typically this would rather be done as additional validation in a CLI or other processing tool, where you know the whole context.)
