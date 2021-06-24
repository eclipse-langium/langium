# Langium CLI

This package provides a command line interface for [Langium](https://www.npmjs.com/package/langium).

Usage: `langium [options] [command]`

Options:
 * `-V`, `--version` &mdash; output the version number
 * `-h`, `--help` &mdash; display help for command

Commands:
 * `generate [options]` &mdash; generate code for a Langium grammar
 * `help [command]` &mdash; display help for command

## Generating Language Infrastructure

The main purpose of this tool is to generate the infrastructure for a language from its grammar declaration file. This command requires a configuration file (currently embedded in the `package.json` of your package).

Usage: `langium generate [options]`

Options:
 * `-f`, `--file <file>` &mdash; the configuration file or package.json setting up the generator
 * `-h`, `--help` &mdash; display help for command

### Configuration

The configuration for the `generate` command is currently embedded in the `package.json`.

Schema:
```
langium: {
    // The identifier of your language as used in vscode
    languageId: string
    // Path to the grammar file
    grammar: string
    // File extensions with leading `.`
    extensions: string[]
    // Main output directory for TypeScript code
    out: string
    // Enable generating a TextMate syntax highlighting file
    textMate: {
        // Output path to syntax highlighting file
        out: string
    }
}
```

Example:
```json
{
    "name": "domainmodel",
    "version": "0.0.1",
    ...
    "langium": {
        "languageId": "domain-model",
        "grammar": "src/language-server/domain-model.langium",
        "extensions": [".dmodel"],
        "out": "src/language-server/generated",
        "textMate": {
            "out": "syntaxes/domain-model.tmLanguage.json"
        }
    }
}
```
