/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/**
 * Execution time benchmark for the Langium parser (lexing + parsing + CST/AST construction).
 *
 * The benchmark uses an in-memory language that covers a large portion of Langium's
 * grammar features (mirroring `langium-grammar.langium`): alternatives, all assignment
 * operators, tree-rewriting and simple actions, fragment rules, unordered groups,
 * guard conditions with rule parameters, single- and multi-target cross-references
 * (with both plain terminal and data type rule terminals), data type rules with value
 * conversion, an infix rule with operator precedence, and hidden comment terminals.
 * This way, the benchmark reaches good coverage of the code in `langium-parser.ts`.
 *
 * Time is measured with `process.hrtime.bigint()`, the highest-resolution monotonic
 * clock available in the Node.js runtime (not subject to system clock adjustments).
 *
 * Run from the `packages/langium` directory with:
 *
 *     node --expose-gc --import tsx test/parser/parser-time-benchmark.ts
 *
 * `--expose-gc` is optional but recommended: it allows the benchmark to start every
 * measured round from a clean heap, which reduces round-to-round variance.
 */

import type { AstNode, LangiumParser, ParseResult } from '../../src/index.js';
import { createServicesForGrammar } from '../../src/grammar/internal-grammar-util.js';
import { streamCst } from '../../src/utils/cst-utils.js';
import { streamAst } from '../../src/utils/ast-utils.js';

declare const global: { gc?: () => void };

const gcAvailable = typeof global.gc === 'function';

function forceGc(): void {
    if (gcAvailable) {
        for (let i = 0; i < 3; i++) {
            global.gc!();
        }
    }
}

const grammar = `
grammar Bench

entry Model:
    imports+=ImportDecl*
    (classes+=ClassDecl | functions+=FunctionDecl | consts+=ConstDecl | typeDecls+=TypeDecl | inits+=InitDecl)*;

ImportDecl: 'import' path=QualifiedName ';';

QualifiedName returns string: ID ('.' ID)*;

fragment Modifiers: (isPublic?='public' & isStatic?='static' & isFinal?='final')?;

ClassDecl:
    Modifiers 'class' name=ID
    ('extends' superType=[ClassDecl:QualifiedName])?
    ('implements' interfaces+=[ClassDecl:QualifiedName] (',' interfaces+=[ClassDecl:QualifiedName])*)?
    '{' members+=Member* '}';

Member: FieldMember | MethodMember | OverrideMember;

FieldMember: Modifiers name=ID ':' type=TypeRef ('=' value=Expression)? ';';

MethodMember: Modifiers 'def' name=ID '(' Params? ')' (':' returnType=TypeRef)? body=Block<true>;

OverrideMember: 'override' target=[+NamedElement:ID] ';';

fragment Params: params+=Param (',' params+=Param)*;

Param: name=ID ':' type=TypeRef;

FunctionDecl: 'fun' name=ID '(' Params? ')' (':' returnType=TypeRef)? body=Block<true>;

ConstDecl: 'const' name=ID (':' type=TypeRef)? '=' value=Expression ';';

TypeDecl: 'type' name=ID '=' type=TypeRef ';';

InitDecl: 'init' body=Block<false>;

NamedElement: ClassDecl | FunctionDecl | ConstDecl | Param | VarStatement | FieldMember | MethodMember;

Block<allowReturn>: {infer Block} '{' statements+=Statement<allowReturn>* '}';

Statement<allowReturn>:
    VarStatement | SetStatement | IfStatement<allowReturn> | WhileStatement<allowReturn> | ExprStatement | <allowReturn> ReturnStatement;

VarStatement: 'var' name=ID (':' type=TypeRef)? '=' value=Expression ';';

SetStatement: 'set' target=[NamedElement:ID] '=' value=Expression ';';

IfStatement<allowReturn>: 'if' '(' condition=Expression ')' thenBlock=Block<allowReturn> ('else' elseBlock=Block<allowReturn>)?;

WhileStatement<allowReturn>: 'while' '(' condition=Expression ')' body=Block<allowReturn>;

ReturnStatement: 'return' (value=Expression)? ';';

ExprStatement: value=Expression ';';

TypeRef: UnionTypeRef;

UnionTypeRef infers TypeRef: ArrayTypeRef ({infer UnionType.types+=current} ('|' types+=ArrayTypeRef)+)?;

ArrayTypeRef infers TypeRef: PrimaryTypeRef ({infer ArrayType.elementType=current} '[' ']')*;

PrimaryTypeRef infers TypeRef:
    '(' TypeRef ')' |
    {infer SimpleType} (ref=[ClassDecl:QualifiedName] | primitive=Primitive);

Primitive returns string: 'string' | 'number' | 'boolean';

Expression: InfixExpr;

infix InfixExpr on UnaryExpr:
    right assoc '**'
    > '*' | '/' | '%'
    > '+' | '-'
    > '<' | '<=' | '>' | '>='
    > '==' | '!='
    > '&&'
    > '||';

UnaryExpr infers Expression:
    {infer UnaryExpr} operator=('!'|'-') operand=UnaryExpr |
    PostfixExpr;

PostfixExpr infers Expression:
    PrimaryExpr ({infer MemberAccess.receiver=current} '.' member=[NamedElement:ID] ('(' (args+=Expression (',' args+=Expression)*)? ')')?)*;

PrimaryExpr infers Expression:
    {infer NumberLit} value=NUMBER |
    {infer StringLit} value=STRING |
    {infer BoolLit} value=BoolValue |
    {infer NullLit} 'null' |
    {infer RefExpr} target=[NamedElement:ID] |
    {infer ParenExpr} '(' value=Expression ')';

BoolValue returns boolean: 'true' | 'false';

terminal ID: /[_a-zA-Z][\\w]*/;
terminal STRING: /"(\\\\.|[^"\\\\])*"/;
terminal NUMBER returns number: /[0-9]+(\\.[0-9]+)?/;
hidden terminal WS: /\\s+/;
hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
hidden terminal SL_COMMENT: /\\/\\/[^\\n\\r]*/;
`;

// ---------------------------------------------------------------------------
// Deterministic input generation (same pseudo-random sequence on every run,
// so results are comparable across runs and branches)
// ---------------------------------------------------------------------------

const TARGET_BYTES = 1_500_000;
const WARMUP_ROUNDS = 10;
const MEASURED_ROUNDS = 30;
const LEX_ROUNDS = 10;

class Rng {
    private seed: number;
    constructor(seed: number) {
        this.seed = seed;
    }
    next(max: number): number {
        this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
        return this.seed % max;
    }
    pick<T>(items: readonly T[]): T {
        return items[this.next(items.length)];
    }
    chance(percent: number): boolean {
        return this.next(100) < percent;
    }
}

const BINARY_OPS = ['**', '*', '/', '%', '+', '-', '<', '<=', '>', '>=', '==', '!=', '&&', '||'] as const;
const PRIMITIVES = ['string', 'number', 'boolean'] as const;

class Generator {
    private readonly rng = new Rng(42);
    private readonly lines: string[] = [];
    private length = 0;
    private classCount = 0;
    private uniqueId = 0;

    generate(): string {
        for (let i = 0; i < 5; i++) {
            this.emit(`import lib${i}.core.module${i};`);
        }
        while (this.length < TARGET_BYTES) {
            const kind = this.rng.next(10);
            if (kind < 6) {
                this.emitClass();
            } else if (kind < 8) {
                this.emitFunction();
            } else if (kind === 8) {
                this.emit(`const ${this.freshName('c')} : ${this.typeRef(0)} = ${this.expression(0)};`);
            } else if (this.rng.chance(60)) {
                this.emit(`type ${this.freshName('T')} = ${this.typeRef(0)};`);
            } else {
                this.emit(`init ${this.block(1, false, '')}`);
            }
        }
        return this.lines.join('\n');
    }

    private emit(line: string): void {
        this.lines.push(line);
        this.length += line.length + 1;
    }

    private freshName(prefix: string): string {
        return `${prefix}_${this.uniqueId++}`;
    }

    private name(prefix: string): string {
        return `${prefix}_${this.rng.next(this.uniqueId + 1)}`;
    }

    private comment(): void {
        const n = this.rng.next(3);
        if (n === 0) {
            this.emit(`// line comment ${this.uniqueId}`);
        } else if (n === 1) {
            this.emit(`/* block comment ${this.uniqueId} */`);
        } else {
            this.emit(`/* multi-line\n * comment ${this.uniqueId}\n */`);
        }
    }

    private modifiers(): string {
        if (this.rng.chance(40)) {
            // The unordered group requires all elements, but accepts them in any order
            const mods = ['public', 'static', 'final'];
            const result: string[] = [];
            while (mods.length > 0) {
                result.push(mods.splice(this.rng.next(mods.length), 1)[0]);
            }
            return result.join(' ') + ' ';
        }
        return '';
    }

    private typeRef(depth: number): string {
        const n = this.rng.next(10);
        if (depth < 2 && n < 2) {
            const count = 2 + this.rng.next(2);
            const parts: string[] = [];
            for (let i = 0; i < count; i++) {
                parts.push(this.typeRef(depth + 1));
            }
            return parts.join(' | ');
        } else if (depth < 2 && n === 2) {
            return `${this.typeRef(depth + 1)}[]`;
        } else if (depth < 2 && n === 3) {
            return `(${this.typeRef(depth + 1)})`;
        } else if (n < 7) {
            return this.rng.pick(PRIMITIVES);
        } else if (this.rng.chance(30)) {
            return `lib${this.rng.next(5)}.Cls_${this.rng.next(this.classCount + 1)}`;
        } else {
            return `Cls_${this.rng.next(this.classCount + 1)}`;
        }
    }

    private expression(depth: number): string {
        const n = this.rng.next(10);
        if (depth < 3 && n < 3) {
            // Binary operator chain, resolved by the infix rule's precedence levels
            const count = 2 + this.rng.next(3);
            let result = this.expression(depth + 1);
            for (let i = 1; i < count; i++) {
                result += ` ${this.rng.pick(BINARY_OPS)} ${this.expression(depth + 1)}`;
            }
            return result;
        } else if (depth < 3 && n === 3) {
            return `(${this.expression(depth + 1)})`;
        } else if (depth < 3 && n === 4) {
            return `${this.rng.pick(['!', '-'])}${this.primary(depth + 1)}`;
        } else if (depth < 3 && n === 5) {
            // Member access chain with occasional call arguments
            let result = this.primary(depth + 1);
            const count = 1 + this.rng.next(2);
            for (let i = 0; i < count; i++) {
                result += `.member_${this.rng.next(50)}`;
                if (this.rng.chance(50)) {
                    const args: string[] = [];
                    const argCount = this.rng.next(3);
                    for (let j = 0; j < argCount; j++) {
                        args.push(this.expression(depth + 1));
                    }
                    result += `(${args.join(', ')})`;
                }
            }
            return result;
        } else {
            return this.primary(depth);
        }
    }

    private primary(depth: number): string {
        const n = this.rng.next(10);
        if (n < 3) {
            return this.rng.chance(30) ? `${this.rng.next(1000)}.${this.rng.next(100)}` : `${this.rng.next(100000)}`;
        } else if (n === 3) {
            return this.rng.chance(20) ? `"str \\"${this.rng.next(1000)}\\" escaped"` : `"string ${this.rng.next(1000)}"`;
        } else if (n === 4) {
            return this.rng.pick(['true', 'false', 'null']);
        } else if (n === 5 && depth < 4) {
            return `(${this.expression(depth + 1)})`;
        } else {
            return this.name('v');
        }
    }

    private block(indentLevel: number, allowReturn: boolean, header: string): string {
        const indent = '    '.repeat(indentLevel);
        const inner = '    '.repeat(indentLevel + 1);
        const lines = [`${header}{`];
        const count = 2 + this.rng.next(4);
        for (let i = 0; i < count; i++) {
            lines.push(inner + this.statement(indentLevel + 1, allowReturn));
        }
        if (allowReturn && this.rng.chance(60)) {
            lines.push(`${inner}return ${this.expression(0)};`);
        }
        lines.push(`${indent}}`);
        return lines.join('\n');
    }

    private statement(indentLevel: number, allowReturn: boolean): string {
        const n = this.rng.next(10);
        if (n < 3) {
            const type = this.rng.chance(50) ? ` : ${this.typeRef(0)}` : '';
            return `var ${this.freshName('v')}${type} = ${this.expression(0)};`;
        } else if (n < 5) {
            return `set ${this.name('v')} = ${this.expression(0)};`;
        } else if (n === 5 && indentLevel < 3) {
            const elsePart = this.rng.chance(50) ? ` else ${this.block(indentLevel, allowReturn, '')}` : '';
            return `if (${this.expression(1)}) ${this.block(indentLevel, allowReturn, '')}${elsePart}`;
        } else if (n === 6 && indentLevel < 3) {
            return `while (${this.expression(1)}) ${this.block(indentLevel, allowReturn, '')}`;
        } else if (n === 7 && allowReturn) {
            return this.rng.chance(50) ? `return ${this.expression(0)};` : 'return;';
        } else {
            return `${this.expression(0)};`;
        }
    }

    private params(): string {
        const count = this.rng.next(4);
        const params: string[] = [];
        for (let i = 0; i < count; i++) {
            params.push(`${this.freshName('p')} : ${this.typeRef(1)}`);
        }
        return params.join(', ');
    }

    private emitFunction(): void {
        if (this.rng.chance(20)) {
            this.comment();
        }
        const returnType = this.rng.chance(60) ? ` : ${this.typeRef(0)}` : '';
        this.emit(`fun ${this.freshName('f')}(${this.params()})${returnType} ${this.block(0, true, '')}`);
    }

    private emitClass(): void {
        if (this.rng.chance(30)) {
            this.comment();
        }
        const name = `Cls_${this.classCount++}`;
        let header = `${this.modifiers()}class ${name}`;
        if (this.classCount > 1 && this.rng.chance(50)) {
            const superRef = this.rng.chance(30) ? `lib0.core.Cls_${this.rng.next(this.classCount - 1)}` : `Cls_${this.rng.next(this.classCount - 1)}`;
            header += ` extends ${superRef}`;
        }
        if (this.classCount > 1 && this.rng.chance(30)) {
            const refs: string[] = [];
            const count = 1 + this.rng.next(2);
            for (let i = 0; i < count; i++) {
                refs.push(`Cls_${this.rng.next(this.classCount - 1)}`);
            }
            header += ` implements ${refs.join(', ')}`;
        }
        this.emit(`${header} {`);
        const memberCount = 3 + this.rng.next(5);
        for (let i = 0; i < memberCount; i++) {
            if (this.rng.chance(10)) {
                this.emit(`    // member comment ${this.uniqueId}`);
            }
            const kind = this.rng.next(10);
            if (kind < 4) {
                const init = this.rng.chance(60) ? ` = ${this.expression(0)}` : '';
                this.emit(`    ${this.modifiers()}${this.freshName('fld')} : ${this.typeRef(0)}${init};`);
            } else if (kind < 9) {
                const returnType = this.rng.chance(60) ? ` : ${this.typeRef(0)}` : '';
                this.emit(`    ${this.modifiers()}def ${this.freshName('m')}(${this.params()})${returnType} ${this.block(1, true, '')}`);
            } else {
                this.emit(`    override m_${this.rng.next(this.uniqueId + 1)};`);
            }
        }
        this.emit('}');
    }
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

function measureMillis(action: () => void): number {
    const start = process.hrtime.bigint();
    action();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6;
}

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
    const variance = samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (samples.length - 1);
    return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median,
        mean,
        stddev: Math.sqrt(variance)
    };
}

const services = await createServicesForGrammar({ grammar });
const parser: LangiumParser = services.parser.LangiumParser;
const lexer = services.parser.Lexer;
const input = new Generator().generate();
const inputBytes = Buffer.byteLength(input, 'utf8');

function parse(): ParseResult<AstNode> {
    const result = parser.parse(input);
    if (result.lexerErrors.length > 0) {
        throw new Error(`Benchmark input has lexer errors: ${result.lexerErrors[0].message}`);
    }
    if (result.parserErrors.length > 0) {
        throw new Error(`Benchmark input has parser errors: ${result.parserErrors[0].message}`);
    }
    return result;
}

// Warm-up: stabilize JIT compilation, hidden classes and inline caches
let cstNodeCount = 0;
let astNodeCount = 0;
let tokenCount = 0;
for (let i = 0; i < WARMUP_ROUNDS; i++) {
    const result = parse();
    if (i === 0) {
        for (const _ of streamCst(result.value.$cstNode!)) {
            cstNodeCount++;
        }
        for (const _ of streamAst(result.value)) {
            astNodeCount++;
        }
        tokenCount = lexer.tokenize(input).tokens.length;
    }
}

console.log(`Input:   ${input.length} chars, ${(inputBytes / 1e6).toFixed(2)} MB (UTF-8)`);
console.log(`Content: ${tokenCount} tokens, ${cstNodeCount} CST nodes, ${astNodeCount} AST nodes`);
console.log(`Rounds:  ${WARMUP_ROUNDS} warm-up, ${MEASURED_ROUNDS} measured (GC between rounds: ${gcAvailable ? 'yes' : 'no — run with --expose-gc for lower variance'})`);
console.log('---');

// Lexer-only baseline (tokenization is included in the full parse time)
const lexTimes: number[] = [];
for (let i = 0; i < LEX_ROUNDS; i++) {
    forceGc();
    lexTimes.push(measureMillis(() => lexer.tokenize(input)));
}
const lexStats = computeStats(lexTimes);
console.log(`Lexing only: median ${lexStats.median.toFixed(1)} ms (${(inputBytes / 1e6 / (lexStats.median / 1000)).toFixed(2)} MB/s)`);
console.log('---');

const times: number[] = [];
for (let round = 0; round < MEASURED_ROUNDS; round++) {
    forceGc();
    const millis = measureMillis(parse);
    times.push(millis);
    console.log(`Round ${String(round + 1).padStart(2)}: ${millis.toFixed(1)} ms (${(inputBytes / 1e6 / (millis / 1000)).toFixed(2)} MB/s)`);
}

const stats = computeStats(times);
console.log('---');
console.log(`Total parse time:  min ${stats.min.toFixed(1)} ms | median ${stats.median.toFixed(1)} ms | mean ${stats.mean.toFixed(1)} ms (±${stats.stddev.toFixed(1)}) | max ${stats.max.toFixed(1)} ms`);
console.log(`Throughput:        ${(inputBytes / 1e6 / (stats.median / 1000)).toFixed(2)} MB/s (median) | ${(inputBytes / 1e6 / (stats.mean / 1000)).toFixed(2)} MB/s (mean)`);
console.log(`Excluding lexing:  ${(stats.median - lexStats.median).toFixed(1)} ms (median) | ${(inputBytes / 1e6 / ((stats.median - lexStats.median) / 1000)).toFixed(2)} MB/s`);
