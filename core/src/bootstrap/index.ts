import * as fs from "fs-extra";
import { generateParser } from "../generator/parser-generator";
import { generateAst } from "../generator/ast-generator";
import { parse } from "../gen/parser";
import { Grammar } from "../gen/ast";
import { linkGrammar } from "./linker";

const input = fs.readFileSync("test.xtext").toString();



const output = parse(input);
const grammar = <Grammar>output.ast;
linkGrammar(grammar);
const parser = generateParser(grammar);
const genAst = generateAst(grammar);
fs.mkdirsSync("src/gen");
fs.writeFileSync("src/gen/parser.ts", parser);
fs.writeFileSync("src/gen/ast.ts", genAst);
debugger;