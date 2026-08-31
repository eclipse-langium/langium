/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/**
 * Workspace build benchmark using the statemachine example language.
 *
 * Unlike the parser benchmarks in `packages/langium/test/parser`, this benchmark
 * runs the full document lifecycle of a real language: documents are created from
 * generated statemachine sources (parsing), then processed end-to-end by the
 * DocumentBuilder (indexing, scope computation, linking, validation).
 *
 * The generated sources are syntactically correct, but include deliberate
 * violations of the statemachine-specific validations (lowercase state names,
 * duplicate state/event names) as well as sporadic linking errors (transitions
 * targeting non-existent states, actions referencing non-existent commands),
 * so that the validation phase produces actual diagnostics.
 *
 * Note that the `langium` package is resolved to its compiled `lib` output,
 * so run `npm run build` in `packages/langium` after switching branches.
 *
 * Run from the `examples/statemachine` directory with:
 *
 *     node --expose-gc --import tsx test/workspace-build-benchmark.ts
 *
 * `--expose-gc` is required for the heap usage measurement.
 */

import type { LangiumDocument } from 'langium';
import { EmptyFileSystem, URI } from 'langium';
import { createStatemachineServices } from '../src/language-server/statemachine-module.js';
import type { Statemachine } from '../src/language-server/generated/ast.js';

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

// ---------------------------------------------------------------------------
// Deterministic input generation (same pseudo-random sequence on every run,
// so results are comparable across runs and branches)
// ---------------------------------------------------------------------------

const DOC_COUNT = 100;
const STATES_PER_DOC = 2600;
const EVENT_COUNT = 30;
const COMMAND_COUNT = 20;
const MIN_TOTAL_BYTES = 10 * 1024 * 1024;
const WARMUP_ROUNDS = 1;
const MEASURED_ROUNDS = 5;

class Rng {
    private seed: number;
    constructor(seed: number) {
        this.seed = seed;
    }
    next(max: number): number {
        this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
        return this.seed % max;
    }
    chance(percent: number): boolean {
        return this.next(100) < percent;
    }
}

interface GeneratedWorkspace {
    texts: string[];
    /** Expected `warning` diagnostics: states whose name starts with a lowercase letter */
    expectedWarnings: number;
    /** Expected `error` diagnostics: duplicate state/event names plus unresolvable cross-references */
    expectedErrors: number;
}

function generateWorkspace(): GeneratedWorkspace {
    const texts: string[] = [];
    let expectedWarnings = 0;
    let expectedErrors = 0;

    for (let d = 0; d < DOC_COUNT; d++) {
        const rng = new Rng(42 + d);
        const lines: string[] = [];

        // State names are fixed up-front so transitions can reference them (forward
        // references included). ~2% start with a lowercase letter, which triggers
        // the `checkStateNameStartsWithCapital` validation.
        const stateNames: string[] = [];
        for (let i = 0; i < STATES_PER_DOC - 2; i++) {
            if (rng.chance(2)) {
                stateNames.push(`s${i}`);
                expectedWarnings++;
            } else {
                stateNames.push(`S${i}`);
            }
        }
        // The last two states share a name, and one event name appears twice.
        // `checkUniqueStatesAndEvents` reports an error on each of the 4 symbols.
        stateNames.push('SDup', 'SDup');
        expectedErrors += 4;

        lines.push(`statemachine Machine${d}`);
        lines.push('');
        lines.push('events');
        for (let i = 0; i < EVENT_COUNT; i++) {
            lines.push(`    ev${i}`);
        }
        lines.push('    ev0'); // duplicate event
        lines.push('');
        lines.push('commands');
        for (let i = 0; i < COMMAND_COUNT; i++) {
            lines.push(`    cmd${i}`);
        }
        lines.push('');
        lines.push(`initialState ${stateNames[0]}`);
        lines.push('');

        for (let i = 0; i < STATES_PER_DOC; i++) {
            lines.push(`state ${stateNames[i]}`);
            if (rng.chance(30)) {
                const actions: string[] = [];
                const actionCount = 1 + rng.next(3);
                for (let j = 0; j < actionCount; j++) {
                    if (rng.chance(1)) {
                        // Linking error: reference to a non-existent command
                        actions.push(`missingCmd${rng.next(1000)}`);
                        expectedErrors++;
                    } else {
                        actions.push(`cmd${rng.next(COMMAND_COUNT)}`);
                    }
                }
                lines.push(`    actions { ${actions.join(' ')} }`);
            }
            const transitionCount = 1 + rng.next(4);
            for (let j = 0; j < transitionCount; j++) {
                const event = `ev${rng.next(EVENT_COUNT)}`;
                let target: string;
                if (rng.chance(1)) {
                    // Linking error: transition to a non-existent state
                    target = `MissingState${rng.next(1000)}`;
                    expectedErrors++;
                } else {
                    target = stateNames[rng.next(STATES_PER_DOC - 2)]; // exclude the SDup pair
                }
                lines.push(`    ${event} => ${target}`);
            }
            lines.push('end');
        }
        texts.push(lines.join('\n'));
    }
    return { texts, expectedWarnings, expectedErrors };
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

interface Stats {
    min: number;
    max: number;
    median: number;
    mean: number;
    stddev: number;
}

function computeStats(samples: number[]): Stats {
    const sorted = samples.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.length > 1
        ? samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (samples.length - 1)
        : 0;
    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median,
        mean,
        stddev: Math.sqrt(variance)
    };
}

const { shared } = createStatemachineServices(EmptyFileSystem);
const documentFactory = shared.workspace.LangiumDocumentFactory;
const langiumDocuments = shared.workspace.LangiumDocuments;
const documentBuilder = shared.workspace.DocumentBuilder;

const { texts, expectedWarnings, expectedErrors } = generateWorkspace();
const totalBytes = texts.reduce((acc, text) => acc + Buffer.byteLength(text, 'utf8'), 0);
if (totalBytes < MIN_TOTAL_BYTES) {
    throw new Error(`Generated workspace is too small: ${totalBytes} bytes (expected at least ${MIN_TOTAL_BYTES})`);
}
const uris = texts.map((_, i) => URI.parse(`inmemory:///machines/machine${i}.statemachine`));

interface RoundResult {
    parseMillis: number;
    buildMillis: number;
    heapDelta: number;
}

async function buildRound(verify: boolean): Promise<RoundResult> {
    forceGc();
    const heapBefore = process.memoryUsage().heapUsed;

    // Document creation parses the source text
    const startParse = process.hrtime.bigint();
    const documents: Array<LangiumDocument<Statemachine>> = texts.map((text, i) => {
        const document = documentFactory.fromString<Statemachine>(text, uris[i]);
        langiumDocuments.addDocument(document);
        return document;
    });
    const startBuild = process.hrtime.bigint();

    // The DocumentBuilder runs the remaining phases: indexing, scope computation,
    // linking, and validation
    await documentBuilder.build(documents, { validation: true });
    const endBuild = process.hrtime.bigint();

    forceGc();
    const heapAfter = process.memoryUsage().heapUsed;

    if (verify) {
        let warnings = 0;
        let errors = 0;
        for (const document of documents) {
            if (document.parseResult.lexerErrors.length > 0 || document.parseResult.parserErrors.length > 0) {
                throw new Error(`Benchmark input has syntax errors in ${document.uri.toString()}`);
            }
            for (const diagnostic of document.diagnostics ?? []) {
                if (diagnostic.severity === 1) {
                    errors++;
                } else if (diagnostic.severity === 2) {
                    warnings++;
                }
            }
        }
        if (warnings !== expectedWarnings || errors !== expectedErrors) {
            throw new Error(`Unexpected diagnostics: ${errors} errors (expected ${expectedErrors}), ${warnings} warnings (expected ${expectedWarnings})`);
        }
        console.log(`Diagnostics per build: ${errors} errors (duplicate names + linking errors), ${warnings} warnings (lowercase state names)`);
    }

    // Remove the documents from the workspace so the next round starts fresh
    await documentBuilder.update([], uris);

    return {
        parseMillis: Number(startBuild - startParse) / 1e6,
        buildMillis: Number(endBuild - startBuild) / 1e6,
        heapDelta: heapAfter - heapBefore
    };
}

console.log(`Workspace: ${DOC_COUNT} documents, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB total (${STATES_PER_DOC} states per document)`);
console.log(`Rounds:    ${WARMUP_ROUNDS} warm-up, ${MEASURED_ROUNDS} measured`);

for (let i = 0; i < WARMUP_ROUNDS; i++) {
    await buildRound(i === 0);
}
console.log('---');

const parseTimes: number[] = [];
const buildTimes: number[] = [];
const totalTimes: number[] = [];
const heapDeltas: number[] = [];
for (let round = 0; round < MEASURED_ROUNDS; round++) {
    const result = await buildRound(false);
    parseTimes.push(result.parseMillis);
    buildTimes.push(result.buildMillis);
    totalTimes.push(result.parseMillis + result.buildMillis);
    heapDeltas.push(result.heapDelta);
    console.log(`Round ${round + 1}: parse ${result.parseMillis.toFixed(0)} ms | build ${result.buildMillis.toFixed(0)} ms | total ${(result.parseMillis + result.buildMillis).toFixed(0)} ms | heap after build: ${(result.heapDelta / 1024 / 1024).toFixed(1)} MiB`);
}

const parseStats = computeStats(parseTimes);
const buildStats = computeStats(buildTimes);
const totalStats = computeStats(totalTimes);
const heapStats = computeStats(heapDeltas);
console.log('---');
console.log(`Parsing (document creation): median ${parseStats.median.toFixed(0)} ms | mean ${parseStats.mean.toFixed(0)} ms (±${parseStats.stddev.toFixed(0)})`);
console.log(`DocumentBuilder (index/link/validate): median ${buildStats.median.toFixed(0)} ms | mean ${buildStats.mean.toFixed(0)} ms (±${buildStats.stddev.toFixed(0)})`);
console.log(`Full build: median ${totalStats.median.toFixed(0)} ms | mean ${totalStats.mean.toFixed(0)} ms (±${totalStats.stddev.toFixed(0)}) | ${(totalBytes / 1e6 / (totalStats.median / 1000)).toFixed(2)} MB/s (median)`);
console.log(`Heap after build: median ${(heapStats.median / 1024 / 1024).toFixed(1)} MiB | mean ${(heapStats.mean / 1024 / 1024).toFixed(1)} MiB (±${(heapStats.stddev / 1024 / 1024).toFixed(1)})`);
