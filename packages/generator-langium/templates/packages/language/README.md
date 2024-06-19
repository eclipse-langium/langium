# The mandatory language package

As a good entry point to our documentation, please use to this [guide](https://langium.org/docs/learn/workflow/write_grammar/).

## What's in the folder?

- [package.json](./package.json) - The manifest file of your language package.
- [tsconfig.json](./tsconfig.json) - The packages specific TypeScript compiler configuration extending the [base config](../../tsconfig.json)
- [src/<%= language-id %>.langium](src/<%= language-id %>.langium) -  the grammar definition of your language
- [src/<%= language-id %>-module.ts](src/<%= language-id %>-module.ts) - the dependency injection module of your language implementation. Use this to register overridden and added services.
- [src/<%= language-id %>-validator.ts](src/<%= language-id %>-validator.ts) - an example validator. You should change it to reflect the semantics of your language
- [src/generated/ast.ts](src/generated/ast.ts) - Generated AST
- [src/generated/grammar.ts](src/generated/grammar.ts) - Generated Grammar
- [src/generated/module.ts](src/generated/module.ts) - Generated Module
- [src/syntaxes/<%= language-id %>.monarch.ts](src/syntaxes/<%= language-id %>.monarch.ts) - Monarch based syntax highlighting instructions
- [syntaxes/<%= language-id %>.tmLanguage.json](syntaxes/<%= language-id %>.tmLanguage.json) - Textmate based syntax highlighting instructions
- [src/index.ts](src/index.ts) Defines what is exported to other packages.
