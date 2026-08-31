/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/**
 * Memory benchmark for large CSTs built via CstNodeBuilder.
 *
 * Run from the `packages/langium` directory with:
 *
 *     node --expose-gc --import tsx test/parser/cst-node-memory-benchmark.ts
 */

import type { IToken, TokenType } from 'chevrotain';
import type { AbstractElement } from '../../src/languages/generated/ast.js';
import type { AstNode, CstNode, RootCstNode } from '../../src/syntax-tree.js';
import type { CompositeCstNodeImpl } from '../../src/parser/cst-node-builder.js';
import { CstNodeBuilder } from '../../src/parser/cst-node-builder.js';

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

// Tree shape: OUTER composites, each containing INNER composites, each containing LEAVES leaf nodes.
const OUTER = 100;
const INNER = 100;
const LEAVES = 100;
const ROUNDS = 5;

const dummyTokenType: TokenType = { name: 'ID' };
const dummyFeature = { $type: 'RuleCall' } as unknown as AbstractElement;
const image = 'xxxx';

function makeToken(offset: number): IToken {
    return {
        image,
        startOffset: offset,
        endOffset: offset + image.length - 1,
        startLine: 1,
        endLine: 1,
        startColumn: offset + 1,
        endColumn: offset + image.length,
        tokenType: dummyTokenType,
        tokenTypeIdx: 1
    };
}

interface BuildResult {
    root: RootCstNode;
    nodeCount: number;
}

// Mimics the parser: `construct` no longer stores the AST backlink; instead it is
// assigned once per AST node on its directly associated CST node after parsing
function constructNode(builder: CstNodeBuilder, $type: string): void {
    const item = { $type, $cstNode: undefined! as CstNode };
    builder.construct(item);
    (item.$cstNode as CompositeCstNodeImpl).astNode = item as unknown as AstNode;
}

function buildLargeCst(): BuildResult {
    const builder = new CstNodeBuilder();
    const root = builder.buildRootNode(image.repeat(OUTER * INNER * LEAVES));
    let nodeCount = 1;
    let offset = 0;
    for (let i = 0; i < OUTER; i++) {
        builder.buildCompositeNode(dummyFeature);
        nodeCount++;
        for (let j = 0; j < INNER; j++) {
            builder.buildCompositeNode(dummyFeature);
            nodeCount++;
            for (let k = 0; k < LEAVES; k++) {
                builder.buildLeafNode(makeToken(offset));
                nodeCount++;
                offset += image.length;
            }
            constructNode(builder, 'Inner');
        }
        constructNode(builder, 'Outer');
    }
    constructNode(builder, 'Root');
    return { root, nodeCount };
}

// Sanity check: the root reference must be reachable from every node
function verify(result: BuildResult): void {
    const composite = result.root.content[0];
    const leaf = (composite as { content?: CstNode[] }).content?.[0].root === result.root;
    if (composite.root !== result.root || !leaf) {
        throw new Error('CST root reference is broken');
    }
    if ((result.root.content[0] as { astNode?: AstNode }).astNode?.$type !== 'Outer') {
        throw new Error('AST node association is broken');
    }
}

console.log(`Building ${ROUNDS} CSTs with ${OUTER} x ${INNER} composites and ${LEAVES} leaves each...`);

// Warm-up so that hidden classes, inline caches etc. are stable before measuring
verify(buildLargeCst());

const retained: BuildResult[] = [];
const deltas: number[] = [];
for (let round = 0; round < ROUNDS; round++) {
    forceGc();
    const before = process.memoryUsage().heapUsed;
    const result = buildLargeCst();
    retained.push(result);
    forceGc();
    const after = process.memoryUsage().heapUsed;
    const delta = after - before;
    deltas.push(delta);
    verify(result);
    console.log(`Round ${round + 1}: ${result.nodeCount} nodes, retained heap delta: ${(delta / 1024 / 1024).toFixed(2)} MiB (${(delta / result.nodeCount).toFixed(1)} bytes/node)`);
}

const nodeCount = retained[0].nodeCount;
const median = deltas.slice().sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
console.log('---');
console.log(`Median retained heap per CST: ${(median / 1024 / 1024).toFixed(2)} MiB`);
console.log(`Median bytes per CST node:    ${(median / nodeCount).toFixed(1)}`);
