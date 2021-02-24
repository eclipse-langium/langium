/* eslint-disable */
import * as fs from "fs";
import { parseXtext } from "./xtext-parser";
import { buildGrammar, linkGrammar } from "./ast-builder";
import { generateParser } from "../generator/parser-generator";

const input = fs.readFileSync("test.xtext").toString();
const result = parseXtext(input);

const ast = buildGrammar(result.cst);
linkGrammar(ast);

const parser = generateParser(ast);
fs.mkdirsSync("src/gen");
fs.writeFileSync("src/gen/parser.ts", parser);