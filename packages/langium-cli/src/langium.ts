/**********************************************************************************
 * Copyright (c) 2021 TypeFox
 *
 * This program and the accompanying materials are made available under the terms
 * of the MIT License, which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import * as fs from 'fs-extra';
import { Command } from 'commander';
import { Package } from './package';
import { Grammar, createLangiumGrammarServices, LangiumDocumentConfiguration, resolveAllReferences } from 'langium';
import { generateGrammarAccess } from './generator/grammar-access-generator';
import { generateParser } from './generator/parser-generator';
import { generateAst } from './generator/ast-generator';
import { generateModule } from './generator/module-generator';

const program = new Command();
program
    .version('0.0.0')
    .option('-d', '--debug')
    .option('-b', '--bootstrap')
    .option('-f', '--file <file>');

program.parse(process.argv);

const opts = program.opts();

const file = opts.file ?? './package.json';
const packageContent = fs.readFileSync(file).toString();
const pack = <Package>JSON.parse(packageContent);

const services = createLangiumGrammarServices();

const grammarFile = pack.langium.grammar ?? 'src/grammar.langium';
const grammarFileContent = fs.readFileSync(grammarFile).toString();
const document = LangiumDocumentConfiguration.create(`file:${grammarFile}`, 'langium', 0, grammarFileContent);
const processedDocument = services.documents.DocumentBuilder.build(document);
const grammar = processedDocument.parseResult.value as Grammar;
document.precomputedScopes = services.references.ScopeComputation.computeScope(grammar);
resolveAllReferences(grammar);
console.log('Generating serialized grammar...');
const json = services.serializer.JsonSerializer.serialize(grammar);
console.log('Generating parser...');
const parser = generateParser(grammar, pack.langium);
console.log('Generating grammar access...');
const grammarAccess = generateGrammarAccess(grammar, pack.langium, opts.b);
console.log('Generating AST...');
const genAst = generateAst(grammar, pack.langium);
console.log('Generating dependency injection module...');
const genModule = generateModule(grammar, pack.langium);

const output = pack.langium.out ?? 'src/generated';

console.log(`Writing generated files to '${output}'`);
fs.mkdirsSync(output);
fs.writeFileSync(`${output}/grammar.json`, json);
fs.writeFileSync(`${output}/parser.ts`, parser);
fs.writeFileSync(`${output}/grammar-access.ts`, grammarAccess);
fs.writeFileSync(`${output}/ast.ts`, genAst);
fs.writeFileSync(`${output}/module.ts`, genModule);
