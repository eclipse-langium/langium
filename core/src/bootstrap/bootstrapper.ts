/* eslint-disable */
// @ts-nocheck
import * as fs from 'fs-extra';
import { Grammar } from '../gen/ast';
import { LangiumGrammarAccess } from '../gen/grammar-access';
import { lexer, parse, Parser } from '../gen/parser';
import { deserialize, serialize } from '../grammar/grammar-utils';
import { linkGrammar } from './linker';
import { generateAst } from '../generator/ast-generator';
import { generateParser } from '../generator/parser-generator';
import { generateGrammarAccess } from '../generator/grammar-access-generator';
import { bootstrap } from '../generator/utils';
import { contentAssist } from '../service/content-assist/content-assist-service';

const input = fs.readFileSync('test.xtext').toString();
const jsonInput = fs.readFileSync('src/gen/grammar.json').toString();
const jsonGrammar = deserialize(jsonInput);
const jsonAccess = new LangiumGrammarAccess(jsonGrammar);
const langiumParser = new Parser(jsonAccess);
const shortInput = input.substring(0, 30);
const tokens = lexer.tokenize(shortInput);
langiumParser.input = tokens.tokens;
const test = langiumParser.parse(shortInput);
const output = parse(jsonAccess, input);

const grammar = <Grammar>output.ast;
linkGrammar(grammar);

const result = contentAssist(jsonGrammar, test, 30);

// const json = serialize(grammar);
// const grammarAccess = generateGrammarAccess(grammar, '../index', false);
// const parser = generateParser(grammar, '../index');
// const genAst = generateAst(grammar, '../index');

// fs.mkdirsSync('src/gen');
// fs.writeFileSync('src/gen/parser.ts', parser);
// fs.writeFileSync('src/gen/ast.ts', genAst);
// fs.writeFileSync('src/gen/grammar.json', json);
// fs.writeFileSync('src/gen/grammar-access.ts', grammarAccess);
