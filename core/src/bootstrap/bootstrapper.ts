/* eslint-disable */
import * as fs from 'fs-extra';
import { Grammar } from '../gen/ast';
import { LangiumGrammarAccess } from '../gen/grammar-access';
import { Parser } from '../gen/parser';
import { serialize } from '../grammar/grammar-utils';
import { linkGrammar } from './linker';
import { generateAst } from '../generator/ast-generator';
import { generateParser } from '../generator/parser-generator';
import { generateGrammarAccess } from '../generator/grammar-access-generator';

const input = fs.readFileSync('test.xtext').toString();
const jsonAccess = new LangiumGrammarAccess();
const langiumParser = new Parser(jsonAccess);
const output = langiumParser.parse(input);

const grammar = <Grammar>output.value;
linkGrammar(grammar);

const json = serialize(grammar);
const grammarAccess = generateGrammarAccess(grammar, '../index', false);
const parser = generateParser(grammar, '../index');
const genAst = generateAst(grammar, '../index');

fs.mkdirsSync('src/gen');
fs.writeFileSync('src/gen/parser.ts', parser);
fs.writeFileSync('src/gen/ast.ts', genAst);
fs.writeFileSync('src/gen/grammar.json', json);
fs.writeFileSync('src/gen/grammar-access.ts', grammarAccess);
