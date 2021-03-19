/* eslint-disable */
// @ts-nocheck
import * as fs from "fs-extra";
import { Grammar } from "../gen/ast";
import { xtextGrammarAccess } from "../gen/grammar-access";
import { parse } from "../gen/parser";
import { generateAst } from "../generator/ast-generator";
import { generate as generateGrammarAccess } from "../generator/grammar-access-generator";
import { generateParser } from "../generator/parser-generator";
import { linkGrammar } from "./linker";
// import { generateParser } from "../generator/parser-generator";
// import { generateAst } from "../generator/ast-generator";
// import { contentAssist } from "../gen2/parser";
// import { Main } from "../gen2/ast";
// import { linkGrammar } from "./linker";

const input = fs.readFileSync("test.xtext").toString();
const jsonInput = fs.readFileSync("src/gen/grammar.json").toString();
const jsonGrammar = JSON.parse(jsonInput);
const output = parse(jsonGrammar, input);
// contentAssist(input, 25);
const grammar = <Grammar>output.ast;
const json = JSON.stringify(grammar);

// console.log(grammar);
linkGrammar(grammar);
const access = new xtextGrammarAccess(grammar);
access.toString();
const grammarAccess = generateGrammarAccess(grammar);
const parser = generateParser(grammar);
const genAst = generateAst(grammar);
// fs.mkdirsSync("src/gen2");
// fs.writeFileSync("src/gen/parser.ts", parser);
// fs.writeFileSync("src/gen/ast.ts", genAst);
fs.writeFileSync("src/gen/grammar.json", json);
// fs.writeFileSync("src/gen/grammar-access.ts", grammarAccess);