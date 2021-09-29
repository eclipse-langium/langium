<div id="langium-logo" align="center">
    <a href="https://github.com/langium/langium">
		<img alt="Langium Logo" width="800" src="https://user-images.githubusercontent.com/4377073/135283991-90ef7724-649d-440a-8720-df13c23bda82.png">
	</a>
    <h3>
        Next-gen language engineering framework 
    </h3>
</div>

<div id="badges" align="center">

  [![npm](https://img.shields.io/npm/v/langium)](https://www.npmjs.com/package/langium)
  [![Build](https://github.com/langium/langium/actions/workflows/build.yml/badge.svg)](https://github.com/langium/langium/actions/workflows/build.yml)
  [![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/langium/langium)

</div>

<hr>

Langium is a language engineering tool with built-in support for the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/). Here are some key facts:

 * Simple and direct integration with the [VS Code extension API](https://code.visualstudio.com/api/language-extensions/overview)
 * Implemented in [TypeScript](https://www.typescriptlang.org/), runs in [NodeJS](https://nodejs.org/)
 * Generates an abstract syntax tree from a grammar declaration
 * The parser is based on [Chevrotain](https://chevrotain.io/)
 * Grammar declaration language similar to [Xtext](https://www.eclipse.org/Xtext/documentation/301_grammarlanguage.html)
 * High out-of-the-box functionality, high extensibility

## Why?

A domain-specific language (DSL) enables domain experts to contribute automatically processable content without any programming knowledge. This is often referred to as _low-code_. The contributed content can describe anything like structural data, behavior, or a mixture of both. By plugging in code generators that operate on the DSL, you create a powerful tool chain that creates technical artifacts from high-level specifications, improves communication between engineers as well as non-technical stakeholders and boosts the overall efficiency.

The main goal of Langium is to lower the barrier of creating a DSL / low-code platform. We achieve this by providing a DSL that describes the syntax and structure of your language: the _grammar language_. Langium's out-of-the-box functionality is based on the information extracted from a grammar declaration. The Xtext framework has proved this approach to be suitable both for rapid prototyping and large-scale applications.

## How?

Langium is available as [npm package](https://www.npmjs.com/package/langium).

Please read the [Contribution Guide](./CONTRIBUTING.md) if you want to contribute to Langium.
