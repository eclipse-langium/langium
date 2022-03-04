# Langium CLI

This package provides a command line interface for [Langium](https://langium.org/).

Usage: `langium [options] [command]`

Options:
 * `-V`, `--version` &mdash; output the version number
 * `-h`, `--help` &mdash; display help for command

Commands:
 * `generate [options]` &mdash; generate code for a Langium grammar
 * `help [command]` &mdash; display help for command

## Generating Language Infrastructure

The main purpose of this tool is to generate the infrastructure for a language from its grammar declaration file. This command requires a configuration file `langium-config.json`.

Usage: `langium generate [options]`

Options:
 * `-f`, `--file <file>` &mdash; the configuration file or package.json setting up the generator
 * `-w`, `--watch` &mdash; enables watch mode
 * `-h`, `--help` &mdash; display help for command

### Configuration

The configuration for the `generate` command is written into a file named `langium-config.json`. Alternatively, it can be embedded in the `package.json` using a property `langium`.

Schema:
```typescript
{
    // Name of the language project
    projectName: string
    // Array of language configurations
    languages: {
        // The identifier of your language as used in vscode
        id: string
        // Path to the grammar file
        grammar: string
        // File extensions with leading `.`
        fileExtensions: string[]
        // Enable case-insensitive keywords parsing
        caseInsensitive: boolean
        // Enable generating a TextMate syntax highlighting file
        textMate: {
            // Output path to syntax highlighting file
            out: string
        }
        // Configure the chevrotain parser for a single language
        chevrotainParserConfig: IParserConfig
    }[]
    // Main output directory for TypeScript code
    out: string
    // Configure the chevrotain parser for all languages
    chevrotainParserConfig: IParserConfig
}
```

Example:
```json
{
    "projectName": "DomainModel",
    "languages": [{
        "id": "domain-model",
        "grammar": "src/language-server/domain-model.langium",
        "fileExtensions": [".dmodel"],
        "textMate": {
            "out": "syntaxes/domain-model.tmLanguage.json"
        }
    }],
    "out": "src/language-server/generated",
    "chevrotainParserConfig": {
        "recoveryEnabled": true,
        "nodeLocationTracking": "full",
        "maxLookahead": 3
    }
}
```
