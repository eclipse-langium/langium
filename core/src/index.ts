import * as fs from "fs-extra";
import { parseXtext } from "./xtext-parser";
import { buildGrammar } from "./ast-builder";

const input = fs.readFileSync("test.xtext").toString();
const result = parseXtext(input);

const ast = buildGrammar(result.cst);
console.log(JSON.stringify(ast));
debugger;