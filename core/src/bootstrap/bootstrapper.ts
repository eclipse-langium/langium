/* eslint-disable */
import * as fs from "fs-extra";
import { Grammar } from "../gen/ast";
import { parse } from "../gen/parser";
import { generateAst } from "../generator/ast-generator";
import { generate as generateGrammarAccess } from "../generator/grammar-access-generator";
import { generateParser } from "../generator/parser-generator";
import { deserialize, serialize } from "../grammar/grammar-utils";
import { linkGrammar } from "./linker";

const input = fs.readFileSync("test.xtext").toString();
const jsonInput = fs.readFileSync("src/gen/grammar.json").toString();
const jsonGrammar = deserialize(jsonInput);
const output = parse(jsonGrammar, input);
const grammar = <Grammar>output.ast;
linkGrammar(grammar);
const json = serialize(grammar);
const grammarAccess = generateGrammarAccess(grammar);
const parser = generateParser(grammar);
const genAst = generateAst(grammar);
fs.mkdirsSync("src/gen");
fs.writeFileSync("src/gen/parser.ts", parser);
fs.writeFileSync("src/gen/ast.ts", genAst);
fs.writeFileSync("src/gen/grammar.json", json);
fs.writeFileSync("src/gen/grammar-access.ts", grammarAccess);

// function reviver(key: any, value: any) {
//     if (typeof value === 'object' && value !== null) {
//         if (value.dataType === 'Map') {
//             return new Map(value.value);
//         }
//     }
//     return value;
// }