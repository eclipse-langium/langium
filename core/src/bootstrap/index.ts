/* eslint-disable */
import * as fs from "fs";
import { parseXtext } from "./xtext-parser";
import { buildGrammar, linkGrammar } from "./ast-builder";
import { generateParser } from "../generator/parser-generator";

const input = fs.readFileSync("core/test.xtext").toString();
const result = parseXtext(input);

const ast = buildGrammar(result.cst);
linkGrammar(ast);

const parser = generateParser(ast);
console.log(parser)
fs.mkdirsSync("core/src/gen");
fs.writeFileSync("core/src/gen/parser.ts", parser);
debugger;