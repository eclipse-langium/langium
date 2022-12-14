/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export * from './default-module';
export * from './dependency-injection';
export * from './generator/generator-node';
export * from './generator/template-node';
export { expandToString, expandToStringWithNL } from './generator/template-string';
export * from './grammar/ast-reflection-interpreter';
export * from './grammar/langium-grammar-module';
export * from './grammar/language-meta-data';
export * from './lsp';
export * from './parser/langium-parser';
export * from './parser/langium-parser-builder';
export * from './parser/parser-config';
export * from './parser/token-builder';
export * from './parser/value-converter';
export * from './parser/lexer';
export * from './references/linker';
export * from './references/name-provider';
export * from './references/scope-computation';
export * from './references/scope-provider';
export * from './serializer/json-serializer';
export * from './service-registry';
export * from './services';
export * from './syntax-tree';
export * from './utils/ast-util';
export * from './utils/collections';
export * from './utils/cst-util';
export * from './utils/grammar-util';
export * from './utils/promise-util';
export * from './utils/uri-util';
export * from './utils/regex-util';
export * from './utils/stream';
export * from './validation/document-validator';
export * from './validation/validation-registry';
export * from './workspace/ast-descriptions';
export * from './workspace/document-builder';
export * from './workspace/documents';
export * from './workspace/index-manager';
export * from './workspace/file-system-provider';
export * from './workspace/workspace-manager';
export * from './workspace/configuration';

// Export the Langium Grammar AST definitions in the `GrammarAST` namespace
import * as GrammarAST from './grammar/generated/ast';
import type { Grammar } from './grammar/generated/ast';
export { Grammar, GrammarAST };
