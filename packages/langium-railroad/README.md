# Langium Railroad Diagrams

This package provides the ability to build railroad syntax diagrams for [Langium](https://langium.org) grammars.

It is reused by the [langium-cli](https://www.npmjs.com/package/langium-cli) package and the [Langium VSCode extension](https://marketplace.visualstudio.com/items?itemName=langium.langium-vscode).

## Railroad diagrams in the grammar hover

The `RailroadHoverProvider` shows the railroad diagram of a parser rule when hovering over its declaration or a reference to it, below the rule's documentation comment. Register it for the grammar language when creating the services:

```ts
import { createLangiumGrammarServices } from 'langium/grammar';
import { RailroadHoverProvider } from 'langium-railroad';

const { shared, grammar } = createLangiumGrammarServices(context, sharedModule, {
    lsp: {
        HoverProvider: (services) => new RailroadHoverProvider(services)
    }
});
```

The diagram is embedded as an image with a data URI, so it's only shown by clients that support images in hovers, like VS Code.
