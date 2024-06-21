# Web-based editor and language server

How the web based editor works is well defined [here](https://langium.org/docs/learn/minilogo/langium_and_monaco).

## What's in the folder?

- [index.html](index.html) - Entry page that let's you decide which web editor version is used.
- [language-configuration.json](language-configuration.json) - The language configuration used in the web editor, defining the tokens that are used for comments and brackets.
- [package.json](./package.json) - The manifest file of your web editor package.
- [src/main-browser.ts](src/main-browser.ts) - The the language server running in a web worker.
- [src/setupClassic.ts](src/setupClassic.ts) - Use monaco-editor with classic configuration (monarch sytax highlighting).
- [src/setupCommon.ts](src/setupCommon.ts) - File containing common settings for monaco-editor.
- [src/setupExtended.ts](src/setupExtended.ts) - Use monaco-editor with extended configuration (textmate sytax highlighting).
- [static/monacoClassic.html](static/monacoClassic.html) - Web page containing the classic monaco-editor.
- [static/monacoExtended.html](static/monacoExtended.html) - Web page containing the extended monaco-editor.
- [static/styles.css](static/styles.css) - Stylesheets used by the HTML pages.
- [tsconfig.json](./tsconfig.json) - The packages specific TypeScript compiler configuration extending the [base config](../../tsconfig.json)
- [vite.config.ts](vite.config.ts) - Vite/rollup production build instructions

## Run the web application

The generation post-step ensure that the whole project is built, so you don't have to repeat it before issuing the next steps below.
You can run chose to run the application either in development mode (code changes are directly available in the application) or production mode (bundled).

For development:

```shell
npm run dev
```

For production:

```shell
npm run serve
```
