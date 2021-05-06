#!/usr/bin/env node
import * as fs from 'fs-extra';
import { Command } from 'commander';
import { Package } from './package';
import { Grammar, LangiumGrammarAccess, linkGrammar, Parser } from 'langium';
import { generateGrammarAccess } from './generator/grammar-access-generator';
import { generateParser } from './generator/parser-generator';
import { generateAst } from './generator/ast-generator';

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

const grammarFile = pack.langium.grammar ?? './grammar.lg';
const grammarFileContent = fs.readFileSync(grammarFile).toString();
const grammar = new Parser(new LangiumGrammarAccess()).parse<Grammar>(grammarFileContent).value;
linkGrammar(grammar);
//const json = serialize(grammar);
const grammarAccess = generateGrammarAccess(grammar, pack.langium.path, opts.b);
const parser = generateParser(grammar, pack.langium.path);
const genAst = generateAst(grammar, pack.langium.path);

const output = pack.langium.out ?? 'src/gen';

fs.mkdirsSync(output);
fs.writeFileSync(`${output}/parser.ts`, parser);
fs.writeFileSync(`${output}/ast.ts`, genAst);
//fs.writeFileSync(`${output}/grammar.json`, json);
fs.writeFileSync(`${output}/grammar-access.ts`, grammarAccess);