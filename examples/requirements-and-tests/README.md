# Multi Language Example (Requirements Model and Test Model)

## Overview

This example allow to model Requirement and Tests Cases in two separate models (with separate languages). Test Cases can reference Requirements (cross language references).

We model Requirements in a simple Requirement Model (Requirements consist of and identifier and a requirement text):

```
req ReqId001 "The cli-tool should allow to extract all test cases referencing a specific requirement"
req R1_tstID "A test identifier shall contain a number."
req RA_reqID "A requirement identifier shall contain a number."
req R3_reqCov "A requirement shall be covered by at least one test"```

Test Cases have also an identifier and the references to the Requirements checked by the test.

## Language Design

Grammars:
  * `common.langium`: common aspects used the main grammars.
  * `requirements.langium`: requirements language (includes `common.langium`)
  * `tests.langium`: requirements language (includes `common.langium` and `requirements.langium`, references `Requirement` elements from `requirements.langium`).

Modules and Services:
  * `createRequirementsAndTestsLanguageServices` creates the full set of services used by the CLI and the language server.
  * `requirements-language-module.ts`: requirements service configuration
  * `tests-language-module.ts`: tests service configuration

Language configuration:
  * `langium-config.json`: TODO, what does this exactly.
  * `package.json`: `contributes` section (TODO, what does this exactly).

## Generator CLI

The Example features a generator that you can run via cli to process Requirement Model files. The outcome is a HTML table with a coverage matrix indicating which Test Cases test the Requirements of the file passed to the CLI.

* Ensure the complete project was properly built, otherwise run `npm install` from the root of the Langium project.
* Use `node ./bin/cli` from the requirements-and-tests directory to run the cli. Follow the instructions or use `node ./bin/cli generate-requirements-coverage <full-path-to-req-file>`.

The generator produces an HTML file.

You also can use `requirements-and-tests-language-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.
* Run `npm install -g ./` from the requirements-and-tests directory.
* Use `requirements-and-tests-language-cli` to run the cli. Follow the instructions or use `requirements-and-tests-language-cli generate-requirements-coverage <full-path-to-req-file>`.

## VSCode Extension

Please use the VSCode run configuration "Run Requirements and Tests Extension" to launch a new VSCode instance including the extension for this language.
Use the run configuration "Attach" to attach the debugger.

## Validators

 * A test identifier shall contain a number.
 * A requirement identifier shall contain a number.
 * A requirement shall be covered by at least one test (TODO: when updating the test model, the requirement is not checked automatically).
