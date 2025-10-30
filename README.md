<div id="langium-logo" align="center">
  <a href="https://github.com/eclipse-langium/langium">
    <img alt="Langium Logo" width="60%" src="https://user-images.githubusercontent.com/4377073/135283991-90ef7724-649d-440a-8720-df13c23bda82.png">
  </a>
  <h3>
    Next-gen language engineering framework
  </h3>
</div>

<div id="badges" align="center">

  [![npm](https://img.shields.io/npm/v/langium)](https://www.npmjs.com/package/langium)
  [![Build](https://github.com/eclipse-langium/langium/actions/workflows/actions.yml/badge.svg)](https://github.com/eclipse-langium/langium/actions/workflows/actions.yml)
  [![Github Discussions](https://img.shields.io/badge/github-discussions-blue?logo=github)](https://github.com/eclipse-langium/langium/discussions)

</div>

---

Eclipse Langium (IPA: /ˈlæŋɡiəm/, like **lang**uage and equilibr**ium**) is a language engineering tool for [TypeScript](https://www.typescriptlang.org/) with built-in support for the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/). The framework is an all-in-one solution for building programming languages, domain specific languages, code generators, interpreters and compilers. It serves as a spiritual successor to the [Eclipse Xtext framework](https://www.eclipse.org/Xtext/).

* **Semantics First:** Building on top of a [grammar declaration language](https://langium.org/docs/reference/grammar-language/), Langium enables you to build the abstract model of your language in parallel to its syntax. Langium parsers are powered by [Chevrotain](https://chevrotain.io).
* **Lean by Default, Customizable by Design:** Langium offers the infrastructure you need to build languages purely by defining their grammar. If that is not enough, you can fine tune every detail of your language using our [dependency injection system](https://langium.org/docs/reference/configuration-services/).
* **Write Once, Run Everywhere:** By leveraging the flexibility of JavaScript and the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), a language written using Langium can run in all kinds of IDEs and browsers or be embedded in CLIs and server applications.

## Installation

Build your first language with Langium in our [online playground](https://langium.org/playground/).

Once you're ready to set up a project, you can use yeoman to generate a [sample Langium project](https://langium.org/docs/learn/workflow/):

```sh
npm i -g yo generator-langium
yo langium
```

## Documentation

You can find the Langium documentation on [the website](https://langium.org/).

If you're new to building programming languages, take a look at [our overview to see what Langium offers](https://langium.org/docs/features/).

The documentation is divided into several sections:

* [Learning Langium](https://langium.org/docs/learn/workflow/)
* [Referece](https://langium.org/docs/reference/)
* [Recipes](https://langium.org/docs/recipes/)
* [Playground](https://langium.org/playground/)

The documentation website is hosted in [this repository](https://github.com/langium/langium-website).

## Examples

We host a number of simple examples in our [main repo](https://github.com/eclipse-langium/langium/tree/main/examples):

* **[arithmetics](https://github.com/eclipse-langium/langium/tree/main/examples/arithmetics)**: How to create an expression language + interpreter.
* **[domainmodel](https://github.com/eclipse-langium/langium/tree/main/examples/domainmodel)**: How to create a language with fully qualified name identifiers.
* **[requirements](https://github.com/eclipse-langium/langium/tree/main/examples/requirements)**: How to create a Langium project with multiple languages.
* **[statemachine](https://github.com/eclipse-langium/langium/tree/main/examples/statemachine)**: How to create a code generator.

More complex examples are available as separate repositories in [our GitHub organization](https://github.com/langium):

* **[lox](https://github.com/langium/langium-lox)**: Implementation of the Lox language from the popular book [Crafting Interpreters](https://craftinginterpreters.com/the-lox-language.html).
* **[minilogo](https://github.com/langium/langium-minilogo)**: Implementation of a [logo](https://el.media.mit.edu/logo-foundation/what_is_logo/logo_programming.html) language dialect. Shows how to integrate Langium in the browser.

## SBOM

To enhance supply chain security and offer users clear insight into project  components, Eclipse Langium now generates a Software Bill of Materials (SBOM) for every release. These are published to the Eclipse Foundation SBOM registry, with access instructions and usage details available in this [documentation](https://eclipse-csi.github.io/security-handbook/sbom/registry.html).

## Contributing

If you want to contribute to Langium, please take a look at [our contributing guide](https://github.com/eclipse-langium/langium/blob/main/CONTRIBUTING.md).

Langium is fully [MIT licensed](https://github.com/eclipse-langium/langium/blob/main/LICENSE).
