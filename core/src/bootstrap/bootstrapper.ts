/* eslint-disable */
import * as fs from "fs-extra";
import { Grammar } from "../gen/ast";
import { xtextGrammarAccess } from "../gen/grammar-access";
import { parse } from "../gen/parser";
import { deserialize, serialize } from "../grammar/grammar-utils";
import { linkGrammar } from "./linker";
import { generateAst } from "../generator/ast-generator";
import { generateParser } from "../generator/parser-generator";
import { generateGrammarAccess } from "../generator/grammar-access-generator";

const input = fs.readFileSync("test.xtext").toString();
const jsonInput = fs.readFileSync("src/gen/grammar.json").toString();
const jsonGrammar = deserialize(jsonInput);
const jsonAccess = new xtextGrammarAccess(jsonGrammar);
// const access = <xtextGrammarAccess2><any>jsonAccess;
// transformAccess(jsonGrammar, access);
const output = parse(jsonAccess, input);
// const g = <Grammar>output.ast;
// linkGrammar(g);

const grammar = <Grammar>output.ast;
linkGrammar(grammar);

// contentAssist(grammar, grammar, 60);

const json = serialize(grammar);
const grammarAccess = generateGrammarAccess(grammar, "../index");
const parser = generateParser(grammar, "../index");
const genAst = generateAst(grammar, "../index");
fs.mkdirsSync("src/gen");
fs.writeFileSync("src/gen/parser.ts", parser);
fs.writeFileSync("src/gen/ast.ts", genAst);
fs.writeFileSync("src/gen/grammar.json", json);
fs.writeFileSync("src/gen/grammar-access.ts", grammarAccess);