/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export * from './default-module';
export * from './dependency-injection';
export * from './service-registry';
export * from './services';
export * from './syntax-tree';
export * from './documentation';
export * from './generator';
export * from './grammar';
export * from './lsp';
export * from './parser';
export * from './references';
export * from './serializer';
export * from './utils';
export * from './validation';
export * from './workspace';

// Export the Langium Grammar AST definitions in the `GrammarAST` namespace
import * as GrammarAST from './grammar/generated/ast';
import type { Grammar } from './grammar/generated/ast';
export { Grammar, GrammarAST };
