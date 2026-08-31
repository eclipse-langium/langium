/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/**
 * Memory benchmark for CSTs produced by a real parser run.
 * Uses an expression grammar with a delegation chain (unassigned rule calls),
 * which is the common case in real-world grammars.
 *
 * Run from the `packages/langium` directory with:
 *
 *     node --expose-gc --import tsx test/parser/cst-parse-memory-benchmark.ts
 */

import type { AstNode, LangiumParser, ParseResult } from '../../src/index.js';
import { createServicesForGrammar } from '../../src/grammar/internal-grammar-util.js';
import { streamCst } from '../../src/utils/cst-utils.js';

declare const global: { gc?: () => void };

if (typeof global.gc !== 'function') {
    console.error('Garbage collector is not exposed. Run with `node --expose-gc --import tsx ...`');
    process.exit(1);
}

function forceGc(): void {
    for (let i = 0; i < 5; i++) {
        global.gc!();
    }
}

const grammar = `
grammar Bench
entry Model: statements+=Statement*;
Statement: 'let' name=ID '=' expr=Expression ';';
Expression: Addition;
Addition: Multiplication ({infer BinaryExpr.left=current} op=('+'|'-') right=Multiplication)*;
Multiplication: Primary ({infer BinaryExpr.left=current} op=('*'|'/') right=Primary)*;
Primary: {infer NumberLiteral} value=NUMBER | {infer VarRef} name=ID | '(' Expression ')';
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal NUMBER: /[0-9]+/;
hidden terminal WS: /\\s+/;
`;

const STATEMENTS = 20_000;
const ROUNDS = 5;

function generateInput(): string {
    const lines: string[] = [];
    for (let i = 0; i < STATEMENTS; i++) {
        lines.push(`let v${i} = 1 + 2 * x${i} + (4 * y${i}) - 5;`);
    }
    return lines.join('\n');
}

const services = await createServicesForGrammar({ grammar });
const parser: LangiumParser = services.parser.LangiumParser;
const input = generateInput();

function parse(): ParseResult<AstNode> {
    const result = parser.parse(input);
    if (result.parserErrors.length > 0 || result.lexerErrors.length > 0) {
        throw new Error('Benchmark input has parse errors');
    }
    return result;
}

// Warm-up
let cstNodeCount = 0;
{
    const result = parse();
    for (const _ of streamCst(result.value.$cstNode!)) {
        cstNodeCount++;
    }
    // Sanity check: AST association must be intact
    const stmt = (result.value as unknown as { statements: AstNode[] }).statements[0];
    if (stmt.$cstNode?.astNode !== stmt) {
        throw new Error('AST association is broken');
    }
}

console.log(`Parsing ${STATEMENTS} statements per round (${input.length} chars, ${cstNodeCount} CST nodes)...`);

const retained: Array<ParseResult<AstNode>> = [];
const deltas: number[] = [];
for (let round = 0; round < ROUNDS; round++) {
    forceGc();
    const before = process.memoryUsage().heapUsed;
    retained.push(parse());
    forceGc();
    const after = process.memoryUsage().heapUsed;
    const delta = after - before;
    deltas.push(delta);
    console.log(`Round ${round + 1}: retained heap delta: ${(delta / 1024 / 1024).toFixed(2)} MiB (${(delta / cstNodeCount).toFixed(1)} bytes/CST node)`);
}

const median = deltas.slice().sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
console.log('---');
console.log(`Median retained heap per parse result: ${(median / 1024 / 1024).toFixed(2)} MiB`);
console.log(`Median bytes per CST node:             ${(median / cstNodeCount).toFixed(1)} (includes AST portion)`);
