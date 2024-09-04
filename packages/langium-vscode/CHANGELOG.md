# Change Log of `langium-vscode`

## v3.2.0 (Sep. 2024)

* Fix a false positive regexp validation ([#1631](https://github.com/eclipse-langium/langium/pull/1631)).
* Make the Langium language server more robust against errors ([#1634](https://github.com/eclipse-langium/langium/pull/1634))

## v3.1.0 (Jun. 2024)

* A few improvements to the grammar language validation ([#1459](https://github.com/eclipse-langium/langium/pull/1459), [#1401](https://github.com/eclipse-langium/langium/pull/1401)).
* Fixed a bunch of grammar type system issues ([#1541](https://github.com/eclipse-langium/langium/pull/1541), [#1506](https://github.com/eclipse-langium/langium/pull/1506), [#1500](https://github.com/eclipse-langium/langium/pull/1500), [#1478](https://github.com/eclipse-langium/langium/pull/1478), [#1473](https://github.com/eclipse-langium/langium/pull/1473)).

## v2.1.0 (Nov. 2023)

* Improve grammar language formatting ([#1185](https://github.com/eclipse-langium/langium/pull/1185)).
* Fix a false positive in the grammar language validation ([#1175](https://github.com/eclipse-langium/langium/pull/1175)).

## v2.0.0 (Aug. 2023)

* Includes a command to open a railroad syntax diagram for the currently selected langium grammar. Use the `Show Railroad Syntax Diagram` command or the corresponding button in the editor title bar to open the diagram ([#1075](https://github.com/eclipse-langium/langium/pull/1075)).
* Improvements to validation regarding cyclic type usage ([#1130](https://github.com/eclipse-langium/langium/pull/1130)).
* The grammar language can now resolve grammar imports transitively ([#1113](https://github.com/eclipse-langium/langium/pull/1113)).

## v1.2.0 (May. 2023)

* Various improvements to the type generator/validator ([#942](https://github.com/eclipse-langium/langium/pull/942), [#946](https://github.com/eclipse-langium/langium/pull/946), [#947](https://github.com/eclipse-langium/langium/pull/947), [#950](https://github.com/eclipse-langium/langium/pull/950), [#973](https://github.com/eclipse-langium/langium/pull/973), [#1003](https://github.com/eclipse-langium/langium/pull/1003)).

## v1.1.0 (Feb. 2023)

* Various improvements to validation of type definitions ([#845](https://github.com/eclipse-langium/langium/pull/845)).

## v1.0.0 (Dec. 2022) 🎉

 * Improved linking of types ([#763](https://github.com/eclipse-langium/langium/pull/763)).
 * Various improvements around the inference and validation of types ([#819](https://github.com/eclipse-langium/langium/pull/819)).
 * White space strings can be used in terminal rules ([#771](https://github.com/eclipse-langium/langium/pull/771)).
 * Keywords of the grammar language can be used as property names ([#811](https://github.com/eclipse-langium/langium/pull/811)).
 * Reserved words of the JavaScript runtime can no longer be used in grammar definitions ([#749](https://github.com/eclipse-langium/langium/pull/749)).
 * The name of a terminal rule must not clash with a keyword ([#820](https://github.com/eclipse-langium/langium/pull/820)).
 * The type of a property must not combine a cross-reference with something else ([#826](https://github.com/eclipse-langium/langium/pull/826)).

---

## v0.5.0 (Oct. 2022)

 * Support _find references_ for properties of declared types ([#528](https://github.com/eclipse-langium/langium/pull/528)).
 * Support _go to definition_ for grammar imports ([#613](https://github.com/eclipse-langium/langium/pull/613)).
 * Highlight usages of declared types ([#531](https://github.com/eclipse-langium/langium/pull/531)).
 * Added a code action to add new parser rule ([#543](https://github.com/eclipse-langium/langium/pull/543)).
 * Various improvements around grammar types ([#548](https://github.com/eclipse-langium/langium/pull/548), [#551](https://github.com/eclipse-langium/langium/pull/551), [#586](https://github.com/eclipse-langium/langium/pull/586), [#670](https://github.com/eclipse-langium/langium/pull/670), [#705](https://github.com/eclipse-langium/langium/pull/705)).

---

## v0.4.0 (Jun. 2022)

 * Hover pop-up shows information for cross-references ([#473](https://github.com/eclipse-langium/langium/pull/473)).
 * Formatting of grammar files is now available ([#479](https://github.com/eclipse-langium/langium/pull/479)).
 * You can "Go to Definition" on property assignments where the return type is explicitly declared ([#505](https://github.com/eclipse-langium/langium/pull/505)).
 * Improved validation and general handling of inferred and declared types.

---

## v0.3.0 (Mar. 2022)

This release brought several changes to the grammar language:

 * Added support for importing other grammar files to state explicitly which rules should be included in your grammar ([#311](https://github.com/eclipse-langium/langium/pull/311)).
   ```
   import './expressions';
   ```
   This makes all declarations of the file `expressions.langium` available in the current grammar.
 * Added support for explicit type declarations in the grammar ([#406](https://github.com/eclipse-langium/langium/pull/406)).
   ```
   interface Entity {
      name: string
      superType?: @Entity
      features: Feature[]
   }

   type Symbol = Entity | PackageDeclaration | DataType | Feature
   ```
   The `interface` form describes the properties of an AST node type. The `@` character used at the `superType` property above denotes a cross-reference to a node of type `Entity`. The `type` form creates _union types_, i.e. an alternative of other declared or inferred types.
 * In addition to regular expressions, terminals now feature an [_extended backus-naur form_](https://langium.org/docs/grammar-language/#more-on-terminal-rules) that enables composition of terminal rules ([#288](https://github.com/eclipse-langium/langium/pull/288)).
 * The `hidden` keyword of the grammar language is now used as modifier for terminals instead of following the top-level grammar declaration ([#288](https://github.com/eclipse-langium/langium/pull/288)).
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
 * Introduced a new `entry` keyword to explicitly mark the entry rule of the parser ([#305](https://github.com/eclipse-langium/langium/pull/305)). Previously the first grammar rule was assumed to be the entry rule.
 * Changed the syntax of cross-references in the grammar ([#306](https://github.com/eclipse-langium/langium/pull/306)). Instead of `property=[Type|TOKEN]`, you now write `property=[Type:TOKEN]`.

---

## v0.2.0 (Nov. 2021)

 * Added features to the grammar editor:
    * Folding ([#178](https://github.com/eclipse-langium/langium/pull/178))
    * Hover ([#182](https://github.com/eclipse-langium/langium/pull/182))
    * Code actions ([#190](https://github.com/eclipse-langium/langium/pull/190))
    * Renaming ([#191](https://github.com/eclipse-langium/langium/pull/191))
 * Configured bracket matching for the editor ([#225](https://github.com/eclipse-langium/langium/pull/225)).
 * Added JSON schema for `langium-config.json` files to support editing the Langium configuration ([#240](https://github.com/eclipse-langium/langium/pull/240)).
