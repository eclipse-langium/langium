#!/usr/bin/env node
import * as fs from 'fs-extra';
import { Command } from 'commander';
import { Package } from './package';
import { Grammar, createLangiumGrammarServices, resolveAllReferences, serialize } from 'langium';
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
const document = services.Parser.parse(grammarFileContent, grammarFile);
const grammar = document.parseResult.value as Grammar;
document.precomputedScopes = services.references.ScopeComputation.computeScope(grammar);
resolveAllReferences(grammar);
const json = serialize(grammar);
const parser = generateParser(grammar, pack.langium);
const grammarAccess = generateGrammarAccess(grammar, pack.langium, opts.b);
const genAst = generateAst(grammar, pack.langium);
const genModule = generateModule(grammar, pack.langium);

const output = pack.langium.out ?? 'src/generated';

fs.mkdirsSync(output);
fs.writeFileSync(`${output}/grammar.json`, json);
fs.writeFileSync(`${output}/parser.ts`, parser);
fs.writeFileSync(`${output}/grammar-access.ts`, grammarAccess);
fs.writeFileSync(`${output}/ast.ts`, genAst);
fs.writeFileSync(`${output}/module.ts`, genModule);
