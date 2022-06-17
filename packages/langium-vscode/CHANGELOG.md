# Change Log of `langium-vscode`

## v0.4.0 (Jun. 2022)

 * Hover pop-up shows information for cross-references ([#473](https://github.com/langium/langium/pull/473)).
 * Formatting of grammar files is now available ([#479](https://github.com/langium/langium/pull/479)).
 * You can "Go to Definition" on property assignments where the return type is explicitly declared ([#505](https://github.com/langium/langium/pull/505)).
 * Improved validation and general handling of inferred and declared types.

---

## v0.3.0 (Mar. 2022)

This release brought several changes to the grammar language:

 * Added support for importing other grammar files to state explicitly which rules should be included in your grammar ([#311](https://github.com/langium/langium/pull/311)).
   ```
   import './expressions';
   ```
   This makes all declarations of the file `expressions.langium` available in the current grammar.
 * Added support for explicit type declarations in the grammar ([#406](https://github.com/langium/langium/pull/406)).
   ```
   interface Entity {
      name: string
      superType?: @Entity
      features: Feature[]
   }

   type Symbol = Entity | PackageDeclaration | DataType | Feature
   ```
   The `interface` form describes the properties of an AST node type. The `@` character used at the `superType` property above denotes a cross-reference to a node of type `Entity`. The `type` form creates _union types_, i.e. an alternative of other declared or inferred types.
 * In addition to regular expressions, terminals now feature an [_extended backus-naur form_](https://langium.org/docs/grammar-language/#more-on-terminal-rules) that enables composition of terminal rules ([#288](https://github.com/langium/langium/pull/288)).
 * The `hidden` keyword of the grammar language is now used as modifier for terminals instead of following the top-level grammar declaration ([#288](https://github.com/langium/langium/pull/288)).
   Instead of
   ```
   grammar Foo
   hidden(WS)

   terminal WS: /\s+/;
   ```
   you now write
   ```
   grammar Foo

   hidden terminal WS: /\s+/;
   ```
 * Introduced a new `entry` keyword to explicitly mark the entry rule of the parser ([#305](https://github.com/langium/langium/pull/305)). Previously the first grammar rule was assumed to be the entry rule.
 * Changed the syntax of cross-references in the grammar ([#306](https://github.com/langium/langium/pull/306)). Instead of `property=[Type|TOKEN]`, you now write `property=[Type:TOKEN]`.

---

## v0.2.0 (Nov. 2021)

 * Added features to the grammar editor:
    * Folding ([#178](https://github.com/langium/langium/pull/178))
    * Hover ([#182](https://github.com/langium/langium/pull/182))
    * Code actions ([#190](https://github.com/langium/langium/pull/190))
    * Renaming ([#191](https://github.com/langium/langium/pull/191))
 * Configured bracket matching for the editor ([#225](https://github.com/langium/langium/pull/225)).
 * Added JSON schema for `langium-config.json` files to support editing the Langium configuration ([#240](https://github.com/langium/langium/pull/240)).
