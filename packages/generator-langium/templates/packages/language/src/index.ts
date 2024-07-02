export * from './<%= language-id %>-module.js';
export * from './<%= language-id %>-validator.js';
export * from './generated/ast.js';
export * from './generated/grammar.js';
export * from './generated/module.js';
export { default as monarchSyntax } from './syntaxes/<%= language-id %>.monarch.js';
