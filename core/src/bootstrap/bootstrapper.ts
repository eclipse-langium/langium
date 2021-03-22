/* eslint-disable */
import * as fs from "fs-extra";
import { Grammar } from "../gen/ast";
import { xtextGrammarAccess } from "../gen/grammar-access";
import { parse } from "../gen/parser";
// import { generateAst } from "../generator/ast-generator";
// import { generate as generateGrammarAccess } from "../generator/grammar-access-generator";
//import { generateParser } from "../generator/parser-generator";
import { deserialize, serialize } from "../grammar/grammar-utils";
import { contentAssist } from "../service/content-assist/content-assist-service";
import { transformAccess } from "./transformer";
import { linkGrammar } from "./linker";
import { generateAst } from "../generator/ast-generator";
import { generateParser } from "../generator/parser-generator";
import { generateGrammarAccess } from "../generator/grammar-access-generator";

const input = fs.readFileSync("test.xtext").toString();
const jsonInput = fs.readFileSync("src/gen/grammar.json").toString();
const jsonGrammar = deserialize(jsonInput);
const jsonAccess = new xtextGrammarAccess(jsonGrammar);
const output = parse(jsonAccess, input);
const g = <Grammar>output.ast;
linkGrammar(g);
const access = new xtextGrammarAccess(g);
transformAccess(g, access);
const grammar = <Grammar>output.ast;
linkGrammar(grammar);

contentAssist(grammar, grammar, 60);

const json = serialize(grammar);
const grammarAccess = generateGrammarAccess(grammar);
const parser = generateParser(grammar);
const genAst = generateAst(grammar);
fs.mkdirsSync("src/gen");
fs.writeFileSync("src/gen/parser.ts", parser);
fs.writeFileSync("src/gen/ast.ts", genAst);
fs.writeFileSync("src/gen/grammar.json", json);
fs.writeFileSync("src/gen/grammar-access.ts", grammarAccess);