/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */
import { isInfixRule } from '../languages/generated/ast.js';
import type { AbstractElement, Action, Assignment, InfixRule, ParserRule } from '../languages/generated/ast.js';
import type { DSLMethodOpts, ILexingError, IOrAlt, IParserErrorMessageProvider, IRecognitionException, IToken, ParserMethod, SubruleMethodOpts, TokenType, TokenVocabulary, IRuleConfig } from 'chevrotain';
import type { Linker } from '../references/linker.js';
import type { LangiumCoreServices } from '../services.js';
import type { AstNode, AstReflection, CompositeCstNode, CstNode, LeafCstNode, Mutable } from '../syntax-tree.js';
import type { Lexer, LexerResult } from './lexer.js';
import type { IParserConfig } from './parser-config.js';
import type { ValueConverter } from './value-converter.js';
import { defaultParserErrorProvider, EmbeddedActionsParser, LLkLookaheadStrategy } from 'chevrotain';
import { LLStarLookaheadStrategy } from 'chevrotain-allstar';
import { isAssignment, isCrossReference, isKeyword, isParserRule } from '../languages/generated/ast.js';
import { getTypeName, isDataTypeRule } from '../utils/grammar-utils.js';
import { assignMandatoryProperties, getContainerOfType, linkContentToContainer } from '../utils/ast-utils.js';
import { isValidTokenRange } from '../utils/cst-utils.js';
import { isAstNode } from '../syntax-tree.js';
import { CstNodeBuilder } from './cst-node-builder.js';
import type { LexingReport } from './token-builder.js';
import type { ProfilingTask } from '../workspace/profiler.js';

export type ParseResult<T = AstNode> = {
    value: T,
    parserErrors: IRecognitionException[],
    lexerErrors: ILexingError[],
    lexerReport?: LexingReport
}

export const DatatypeSymbol = Symbol('Datatype');

interface DataTypeNode {
    $cstNode: CompositeCstNode
    /** Instead of a string, this node is uniquely identified by the `Datatype` symbol */
    $type: symbol
    /** Used as a storage for all parsed terminals, keywords and sub-datatype rules */
    value: string
}

interface InfixElement {
    $infixName: string;
    $type: string;
    $cstNode: CompositeCstNode;
    parts?: AstNode[];
    operators?: string[];
}

function isDataTypeNode(node: { $type: string | symbol | undefined }): node is DataTypeNode {
    return node.$type === DatatypeSymbol;
}

type RuleResult = (args: Args) => any;

type Args = Record<string, boolean>;

type RuleImpl = (args: Args) => any;

interface AssignmentElement {
    assignment?: Assignment
    crossRef?: 'single' | 'multi'
}

/**
 * Base interface for all parsers. Mainly used by the `parser-builder-base.ts` to perform work on different kinds of parsers.
 * The main use cases are:
 * * AST parser: Based on a string, create an AST for the current grammar
 * * Completion parser: Based on a partial string, identify the current position of the input within the grammar
 */
export interface BaseParser {
    /**
     * Adds a new parser rule to the parser
     */
    rule(rule: ParserRule | InfixRule, impl: RuleImpl): RuleResult;
    /**
     * Returns the executable rule function for the specified rule name
     */
    getRule(name: string): RuleResult | undefined;
    /**
     * Performs alternatives parsing (the `|` operation in EBNF/Langium)
     */
    alternatives(idx: number, choices: Array<IOrAlt<any>>): void;
    /**
     * Parses the callback as optional (the `?` operation in EBNF/Langium)
     */
    optional(idx: number, callback: DSLMethodOpts<unknown>): void;
    /**
     * Parses the callback 0 or more times (the `*` operation in EBNF/Langium)
     */
    many(idx: number, callback: DSLMethodOpts<unknown>): void;
    /**
     * Parses the callback 1 or more times (the `+` operation in EBNF/Langium)
     */
    atLeastOne(idx: number, callback: DSLMethodOpts<unknown>): void;
    /**
     * Consumes a specific token type from the token input stream.
     * Requires a unique index within the rule for a specific token type.
     */
    consume(idx: number, tokenType: TokenType, feature: AbstractElement): void;
    /**
     * Invokes the executable function for a given parser rule.
     * Requires a unique index within the rule for a specific sub rule.
     * Arguments can be supplied to the rule invocation for semantic predicates
     */
    subrule(idx: number, rule: RuleResult, fragment: boolean, feature: AbstractElement, args: Args): void;
    /**
     * Executes a grammar action that modifies the currently active AST node
     */
    action($type: string, action: Action): void;
    /**
     * Whether the parser is currently actually in use or in "recording mode".
     * Recording mode is activated once when the parser is analyzing itself.
     * During this phase, no input exists and therefore no AST should be constructed
     */
    isRecording(): boolean;
    /**
     * Current state of the unordered groups
     */
    get unorderedGroups(): Map<string, boolean[]>;
    /**
     * The rule stack indicates the indices of rules that are currently invoked,
     * in order of their invocation.
     */
    getRuleStack(): number[];
}

const ruleSuffix = '\u200B';
const withRuleSuffix = (name: string): string => name.endsWith(ruleSuffix) ? name : name + ruleSuffix;

export abstract class AbstractLangiumParser implements BaseParser {

    protected readonly lexer: Lexer;
    protected readonly wrapper: ChevrotainWrapper;
    protected _unorderedGroups: Map<string, boolean[]> = new Map<string, boolean[]>();

    protected allRules = new Map<string, RuleResult>();
    protected mainRule!: RuleResult;

    /**
     * Whether `finalize()` has completed Chevrotain's self-analysis. Rule bodies only run while Chevrotain records
     * the grammar during that self-analysis, or while parsing afterwards, so this alone answers `isRecording()`.
     * Subclasses that override `finalize()` must call `super.finalize()`.
     */
    private selfAnalysisDone = false;

    constructor(services: LangiumCoreServices, incomplete: boolean) {
        this.lexer = services.parser.Lexer;
        const tokens = this.lexer.definition;
        const production = services.LanguageMetaData.mode === 'production';
        if (services.shared.profilers.LangiumProfiler?.isActive('parsing')) {
            this.wrapper = new ProfilerWrapper(tokens, {
                ...services.parser.ParserConfig,
                skipValidations: production,
                errorMessageProvider: services.parser.ParserErrorMessageProvider
            }, incomplete, services.shared.profilers.LangiumProfiler.createTask('parsing', services.LanguageMetaData.languageId));
        } else {
            this.wrapper = new ChevrotainWrapper(tokens, {
                ...services.parser.ParserConfig,
                skipValidations: production,
                errorMessageProvider: services.parser.ParserErrorMessageProvider
            }, incomplete);
        }
    }

    alternatives(idx: number, choices: Array<IOrAlt<any>>): void {
        this.wrapper.wrapOr(idx, choices);
    }

    optional(idx: number, callback: DSLMethodOpts<unknown>): void {
        this.wrapper.wrapOption(idx, callback);
    }

    many(idx: number, callback: DSLMethodOpts<unknown>): void {
        this.wrapper.wrapMany(idx, callback);
    }

    atLeastOne(idx: number, callback: DSLMethodOpts<unknown>): void {
        this.wrapper.wrapAtLeastOne(idx, callback);
    }

    abstract rule(rule: ParserRule | InfixRule, impl: RuleImpl): RuleResult;
    abstract consume(idx: number, tokenType: TokenType, feature: AbstractElement): void;
    abstract subrule(idx: number, rule: RuleResult, fragment: boolean, feature: AbstractElement, args: Args): void;
    abstract action($type: string, action: Action): void;

    getRule(name: string): RuleResult | undefined {
        return this.allRules.get(name);
    }

    isRecording(): boolean {
        return !this.selfAnalysisDone;
    }

    get unorderedGroups(): Map<string, boolean[]> {
        return this._unorderedGroups;
    }

    getRuleStack(): number[] {
        return (this.wrapper as any).RULE_STACK;
    }

    finalize(): void {
        // Reset first: a repeated self-analysis records the grammar again.
        this.selfAnalysisDone = false;
        this.wrapper.wrapSelfAnalysis();
        this.selfAnalysisDone = true;
    }
}

export interface ParserOptions {
    rule?: string
    /**
     * Whether to build the concrete syntax tree (CST). Defaults to `true`.
     *
     * With `false`, the parser builds only the AST. The AST, the lexer errors and the parser errors are
     * the same as with a CST. Use this for documents that are never mapped back to source positions,
     * e.g. documents that a headless batch build only resolves references against. Such a document lacks:
     * - `$cstNode` on its AST nodes;
     * - `$refNode` on its references. The reference index skips references without `$refNode`, so it
     *   doesn't know what the document depends on, and an incremental build doesn't relink the
     *   document when the targets of its references change;
     * - comments and other hidden tokens;
     * - ranges and positions: diagnostics fall back to an empty range at the start of the document,
     *   and exported names have no name segment.
     *
     * So everything that reads the CST gets nothing for such a document, e.g. comment providers,
     * formatting, hover, document symbols, find references and the other LSP services that map
     * between the AST and the text.
     *
     * A document created this way doesn't stay CST-free: `LangiumDocumentFactory.update` re-parses it
     * with a CST, e.g. when it is opened in an editor or changes on disk.
     *
     * This option is only honoured if the language's {@link ValueConverter} declares
     * {@link ValueConverter.supportsCstFreeConversion}, since without a CST its `convert` method
     * receives a stand-in node that only carries `grammarSource`. Otherwise the CST is built anyway,
     * without notice. This only depends on the language, so callers can check it before parsing,
     * with `services.parser.ValueConverter.supportsCstFreeConversion === true`.
     */
    buildCst?: boolean
}

interface OperatorPrecedence {
    precedence: number
    rightAssoc: boolean
}

/** {@link LangiumParser.ruleCallCut}: the subrule has run no assigned action yet. */
const NO_CUT = -1;
/** {@link LangiumParser.ruleCallCut}: the subrule ran an assigned action before it consumed any token. */
const EMPTY_CUT = -2;

export class LangiumParser extends AbstractLangiumParser {
    private readonly linker: Linker;
    private readonly converter: ValueConverter;
    private readonly astReflection: AstReflection;
    private readonly nodeBuilder = new CstNodeBuilder();
    private lexerResult?: LexerResult;
    private stack: any[] = [];
    private assignmentMap = new Map<AbstractElement, AssignmentElement | undefined>();
    private operatorPrecedence = new Map<string, Map<string, OperatorPrecedence>>();

    /**
     * Whether the current parser run builds a CST, see {@link ParserOptions.buildCst}.
     *
     * The parser itself reads the CST in three places. Without a CST, each is replaced:
     * 1. Value conversion reads the grammar element of the leaf or composite node:
     *    the converter receives {@link grammarSourceNode} instead.
     * 2. A subrule result is only assigned if the subrule's composite node has a non-empty source span
     *    (`cstNode.length > 0`): the span of the consumed tokens is tracked instead, through
     *    {@link ruleCallFirst} and {@link lastNodeEnd} (see {@link subruleWithoutCst}).
     * 3. A datatype rule is converted with the grammar element that invoked it:
     *    {@link ruleCallStack} tracks the invoking elements.
     */
    private buildCst = true;
    /**
     * End offset (exclusive) of the last node in the current CST-free parser run, see {@link extendSpan}: the last
     * consumed valid token, or an empty composite node that an assigned action keeps (end 0). 0 before the first.
     */
    private lastNodeEnd = 0;
    /** The grammar elements of the active non-fragment subrule calls of a CST-free parser run. */
    private readonly ruleCallStack: AbstractElement[] = [];
    /**
     * Per entry of {@link ruleCallStack}: the start offset of the first node of the subrule call (usually its first
     * valid token), or -1 if there was none yet. {@link extendSpan} sets it for the entries from {@link firstPending} upwards.
     */
    private readonly ruleCallFirst: number[] = [];
    /**
     * Index of the lowest entry of {@link ruleCallFirst} without a token yet. The entries above it have none
     * either, since subrule calls receive their first token in the order they were entered.
     */
    private firstPending = 0;
    /**
     * Per entry of {@link ruleCallStack}: the value of {@link lastNodeEnd} at the first assigned action of the
     * subrule, {@link EMPTY_CUT} if the subrule had consumed no token by then, or {@link NO_CUT} if there was
     * no such action yet. With a CST, an assigned action moves the subrule's composite node below a new node,
     * so later tokens do not count for the subrule's assignment.
     */
    private readonly ruleCallCut: number[] = [];

    private get current(): any {
        return this.stack[this.stack.length - 1];
    }

    constructor(services: LangiumCoreServices) {
        super(services, false);
        this.linker = services.references.Linker;
        this.converter = services.parser.ValueConverter;
        this.astReflection = services.shared.AstReflection;
    }

    rule(rule: ParserRule | InfixRule, impl: RuleImpl): RuleResult {
        const type = this.computeRuleType(rule);
        let infixName: string | undefined = undefined;
        if (isInfixRule(rule)) {
            infixName = rule.name;
            this.registerPrecedenceMap(rule);
        }
        const ruleMethod = this.wrapper.DEFINE_RULE(withRuleSuffix(rule.name), this.startImplementation(type, infixName, impl).bind(this));
        this.allRules.set(rule.name, ruleMethod);
        if (isParserRule(rule) && rule.entry) {
            this.mainRule = ruleMethod;
        }
        return ruleMethod;
    }

    private registerPrecedenceMap(rule: InfixRule): void {
        const name = rule.name;
        const map = new Map<string, OperatorPrecedence>();
        for (let i = 0; i < rule.operators.precedences.length; i++) {
            const precedence = rule.operators.precedences[i];
            for (const keyword of precedence.operators) {
                map.set(keyword.value, {
                    precedence: i,
                    rightAssoc: precedence.associativity === 'right'
                });
            }
        }
        this.operatorPrecedence.set(name, map);
    }

    private computeRuleType(rule: ParserRule | InfixRule): string | symbol | undefined {
        if (isInfixRule(rule)) {
            return getTypeName(rule);
        } else if (rule.fragment) {
            return undefined;
        } else if (isDataTypeRule(rule)) {
            return DatatypeSymbol;
        } else {
            return getTypeName(rule);
        }
    }

    parse<T extends AstNode = AstNode>(input: string, options: ParserOptions = {}): ParseResult<T> {
        // Without a CST, the value converter only receives the grammar element. A converter that has
        // not declared that this is enough for it gets a CST as before.
        this.buildCst = options.buildCst !== false || this.converter.supportsCstFreeConversion !== true;
        if (this.buildCst) {
            this.nodeBuilder.buildRootNode(input);
        } else {
            // Release the tree of a previous parser run, which would otherwise stay reachable from the builder
            this.nodeBuilder.clear();
            this.lastNodeEnd = 0;
            this.ruleCallStack.length = 0;
            this.ruleCallFirst.length = 0;
            this.firstPending = 0;
            this.ruleCallCut.length = 0;
        }
        const lexerResult = this.lexerResult = this.lexer.tokenize(input);
        this.wrapper.input = lexerResult.tokens;
        const ruleMethod = options.rule ? this.allRules.get(options.rule) : this.mainRule;
        if (!ruleMethod) {
            throw new Error(options.rule ? `No rule found with name '${options.rule}'` : 'No main rule available.');
        }
        const result = this.doParse(ruleMethod);
        if (this.buildCst) {
            this.nodeBuilder.addHiddenNodes(lexerResult.hidden);
        }
        this.unorderedGroups.clear();
        this.lexerResult = undefined;
        linkContentToContainer(result, { deep: true });
        return {
            value: result,
            lexerErrors: lexerResult.errors,
            lexerReport: lexerResult.report,
            parserErrors: this.wrapper.errors
        };
    }

    private doParse(rule: RuleResult): any {
        let result = this.wrapper.rule(rule);
        if (this.stack.length > 0) {
            // In case the parser throws on the entry rule, `construct` is not called
            // We need to call it manually here
            result = this.construct();
        }
        // Perform some sanity checking
        if (result === undefined) {
            throw new Error('No result from parser');
        } else if (this.stack.length > 0) {
            throw new Error('Parser stack is not empty after parsing');
        }
        this.linkCstNode(result);
        return result;
    }

    /**
     * Assigns the CST-to-AST backlink for the given AST node. The link is stored only on the
     * CST node that is directly associated with an AST node (i.e. its `$cstNode`); all other
     * CST nodes find their AST node by walking up the container hierarchy in the `astNode`
     * getter. This method is called once per AST node as soon as its `$cstNode` is final:
     * for the parse result root here in `doParse`, for all other nodes in `assign`.
     */
    private linkCstNode(item: unknown): void {
        if (isAstNode(item) && item.$cstNode) {
            (item.$cstNode as Mutable<CstNode>).astNode = item;
        }
    }

    private startImplementation($type: string | symbol | undefined, infixName: string | undefined, implementation: RuleImpl): RuleImpl {
        return (args) => {
            // Only create a new AST node in case the calling rule is not a fragment rule
            const createNode = !this.isRecording() && $type !== undefined;
            if (createNode) {
                const node: any = { $type };
                this.stack.push(node);
                if ($type === DatatypeSymbol) {
                    node.value = '';
                } else if (infixName !== undefined) {
                    node.$infixName = infixName;
                }
            }
            // Execute the actual rule implementation
            // The `implementation` never returns anything and only manipulates the parser state.
            implementation(args);
            // Once the rule implementation is done, we need to construct the AST node
            // If the implementation throws (likely a recognition error), we relay the construction to the `subrule` method
            return createNode ? this.construct() : undefined;
        };
    }

    private extractHiddenTokens(token: IToken): IToken[] {
        const hiddenTokens = this.lexerResult!.hidden;
        if (!hiddenTokens.length) {
            return [];
        }
        const offset = token.startOffset;
        for (let i = 0; i < hiddenTokens.length; i++) {
            const token = hiddenTokens[i];
            if (token.startOffset > offset) {
                return hiddenTokens.splice(0, i);
            }
        }
        return hiddenTokens.splice(0, hiddenTokens.length);
    }

    consume(idx: number, tokenType: TokenType, feature: AbstractElement): void {
        const token = this.wrapper.wrapConsume(idx, tokenType);
        if (!this.isRecording() && this.isValidToken(token)) {
            let leafNode: LeafCstNode | undefined;
            if (this.buildCst) {
                // Before inserting the current token into the CST, we want add the hidden tokens (i.e. comments)
                // These are located directly before the current token, but are not part of the token stream.
                // Adding the hidden tokens to the CST requires searching through the CST and finding the correct position.
                // Performing this work here is more efficient than doing it later on.
                const hiddenTokens = this.extractHiddenTokens(token);
                this.nodeBuilder.addHiddenNodes(hiddenTokens);
                leafNode = this.nodeBuilder.buildLeafNode(token, feature);
            } else {
                // Like the end of a leaf node: a token may be empty, e.g. the DEDENT of an indentation-aware lexer
                this.extendSpan(token.startOffset, token.startOffset + token.image.length);
            }
            const { assignment, crossRef } = this.getAssignment(feature);
            const current = this.current;
            if (assignment) {
                const convertedValue = isKeyword(feature) ? token.image : this.converter.convert(token.image, leafNode ?? this.grammarSourceNode(feature));
                this.assign(assignment.operator, assignment.feature, convertedValue, leafNode, crossRef);
            } else if (isDataTypeNode(current)) {
                let text = token.image;
                if (!isKeyword(feature)) {
                    text = this.converter.convert(text, leafNode ?? this.grammarSourceNode(feature)).toString();
                }
                current.value += text;
            }
        }
    }

    /**
     * Returns the stand-in for a CST node that is passed to the value converter when no CST is built.
     * It only carries the grammar element; see {@link ValueConverter.supportsCstFreeConversion}.
     * Every call creates a new object, so a converter that keeps the node it receives
     * still sees its own grammar element later.
     */
    private grammarSourceNode(feature: AbstractElement | undefined): CstNode {
        return { grammarSource: feature } as CstNode;
    }

    /**
     * Most consumed parser tokens are valid. However there are two cases in which they are not valid:
     *
     * 1. They were inserted during error recovery by the parser. These tokens don't really exist and should not be further processed
     * 2. They contain invalid token ranges. This might include the special EOF token, or other tokens produced by invalid token builders.
     */
    private isValidToken(token: IToken): boolean {
        return !token.isInsertedInRecovery && isValidTokenRange(token);
    }

    subrule(idx: number, rule: RuleResult, fragment: boolean, feature: AbstractElement, args: Args): void {
        if (!this.buildCst && !this.isRecording()) {
            this.subruleWithoutCst(idx, rule, fragment, feature, args);
            return;
        }
        let cstNode: CompositeCstNode | undefined;
        if (!this.isRecording() && !fragment) {
            // We only want to create a new CST node if the subrule actually creates a new AST node.
            // In other cases like calls of fragment rules the current CST/AST is populated further.
            // Note that skipping this initialization and leaving cstNode unassigned also skips the subrule assignment later on.
            // This is intended, as fragment rules only enrich the current AST node
            cstNode = this.nodeBuilder.buildCompositeNode(feature);
        }
        let result: any;
        try {
            result = this.wrapper.wrapSubrule(idx, rule, args);
        } finally {
            if (!this.isRecording()) {
                // Calling `subrule` on chevrotain parsers can result in a recognition error
                // This likely means that we encounter a syntax error in the input.
                // In this case, the result of the subrule is `undefined` and we need to call `construct` manually.
                if (result === undefined && !fragment) {
                    result = this.construct();
                }
                // We want to perform the subrule assignment regardless of the recognition error
                // But only if the subrule call actually consumed any tokens
                if (result !== undefined && cstNode && cstNode.length > 0) {
                    this.performSubruleAssignment(result, feature, cstNode);
                }
            }
            // We don't have a catch block in here because we want to propagate the recognition error to the caller
            // This results in much better error recovery and error messages from chevrotain
        }
    }

    /**
     * The CST-free counterpart of {@link subrule}. `subrule` assigns the result only if the subrule's composite
     * node has a non-empty source span (`cstNode.length > 0`), i.e. from the start of its first token to the end
     * of its last one. Counting tokens isn't enough, since a valid token can be empty: an indentation-aware
     * lexer emits DEDENTs without text. So this compares the same span: the start offset of the first consumed
     * token with the end offset of the last one. If the subrule ran an assigned action, the span ends at that
     * action, since the CST-building parser moves the composite node below the action's node there.
     */
    private subruleWithoutCst(idx: number, rule: RuleResult, fragment: boolean, feature: AbstractElement, args: Args): void {
        // Fragment rules only enrich the current AST node and are never assigned, see `subrule`
        if (!fragment) {
            this.ruleCallStack.push(feature);
            this.ruleCallFirst.push(-1);
            this.ruleCallCut.push(NO_CUT);
        }
        let result: any;
        try {
            result = this.wrapper.wrapSubrule(idx, rule, args);
        } finally {
            if (!fragment) {
                if (result === undefined) {
                    result = this.construct();
                }
                this.ruleCallStack.pop();
                const first = this.ruleCallFirst.pop()!;
                if (this.firstPending > this.ruleCallFirst.length) {
                    this.firstPending = this.ruleCallFirst.length;
                }
                // Only the tokens consumed before the subrule's first assigned action count. With a CST, `action()`
                // doesn't extend the subrule's composite node: it moves that node below the action's new composite
                // node. Tokens consumed after the action go into the action's node, so the original node's `length`,
                // which `subrule` checks, stops growing at the first action. A later action moves the previous
                // action's node, not the original node, so its cut doesn't matter (`action()` keeps the first one).
                const cut = this.ruleCallCut.pop()!;
                const end = cut === NO_CUT ? this.lastNodeEnd : cut;
                // An `EMPTY_CUT` is negative, so it never passes
                if (result !== undefined && first >= 0 && end > first) {
                    this.performSubruleAssignment(result, feature, undefined);
                }
            }
        }
    }

    /**
     * Adds a node with the given offsets to the source spans of the active subrule calls of a CST-free parser run:
     * it is the first node of every subrule call entered since the previous one, and the last node so far.
     */
    private extendSpan(offset: number, end: number): void {
        const calls = this.ruleCallFirst.length;
        for (let i = this.firstPending; i < calls; i++) {
            this.ruleCallFirst[i] = offset;
        }
        this.firstPending = calls;
        this.lastNodeEnd = end;
    }

    private performSubruleAssignment(result: any, feature: AbstractElement, cstNode: CompositeCstNode | undefined): void {
        const { assignment, crossRef } = this.getAssignment(feature);
        if (assignment) {
            this.assign(assignment.operator, assignment.feature, result, cstNode, crossRef);
        } else if (!assignment) {
            // If we call a subrule without an assignment we either:
            // 1. append the result of the subrule (data type rule)
            // 2. override the current object with the newly parsed object
            // If the current element is an AST node and the result of the subrule
            // is a data type rule, we can safely discard the results.
            const current = this.current;
            if (isDataTypeNode(current)) {
                current.value += result.toString();
            } else if (typeof result === 'object' && result) {
                const object = this.assignWithoutOverride(result, current);
                const newItem = object;
                this.stack.pop();
                this.stack.push(newItem);
            }
        }
    }

    action($type: string, action: Action): void {
        if (!this.isRecording()) {
            let last = this.current;
            if (action.feature && action.operator) {
                last = this.construct();
                if (this.buildCst) {
                    this.nodeBuilder.removeNode(last.$cstNode);
                    const node = this.nodeBuilder.buildCompositeNode(action);
                    this.nodeBuilder.appendChild(node, last.$cstNode);
                } else {
                    // Tokens consumed from here on no longer count for the enclosing subrule call, see `subruleWithoutCst`
                    const top = this.ruleCallCut.length - 1;
                    if (top >= 0 && this.ruleCallCut[top] === NO_CUT) {
                        if (this.ruleCallFirst[top] < 0) {
                            this.ruleCallCut[top] = EMPTY_CUT;
                            // With a CST, the subrule's composite node is still empty here. The action keeps it below
                            // its own node, and an empty composite node has offset 0 and end 0 (it has no first or last
                            // child). So for the enclosing subrule calls, it counts like an empty token at offset 0.
                            this.extendSpan(0, 0);
                        } else {
                            this.ruleCallCut[top] = this.lastNodeEnd;
                        }
                    }
                }
                const newItem = { $type };
                this.stack.push(newItem);
                // Without a CST, `last.$cstNode` is undefined
                this.assign(action.operator, action.feature, last, last.$cstNode);
            } else {
                last.$type = $type;
            }
        }
    }

    private construct(): unknown {
        if (this.isRecording()) {
            return undefined;
        }
        const obj = this.stack.pop();
        if (this.buildCst) {
            this.nodeBuilder.construct(obj);
        }
        if ('$infixName' in obj) {
            return this.constructInfix(obj, this.operatorPrecedence.get(obj.$infixName)!);
        } else if (isDataTypeNode(obj)) {
            // With a CST, the datatype rule's composite node carries the grammar element that invoked the rule
            const cstNode = this.buildCst ? obj.$cstNode : this.grammarSourceNode(this.ruleCallStack[this.ruleCallStack.length - 1]);
            return this.converter.convert(obj.value, cstNode);
        } else {
            assignMandatoryProperties(this.astReflection, obj);
        }
        return obj;
    }

    private constructInfix(obj: InfixElement, precedence: Map<string, OperatorPrecedence>): any {
        const parts = obj.parts;
        if (!Array.isArray(parts) || parts.length === 0) {
            // Likely the result of a syntax error, simply return undefined
            return undefined;
        }
        const operators = obj.operators;
        if (!Array.isArray(operators) || parts.length < 2) {
            // Captured just a single, non-binary expression
            // Simply return the expression as is.
            return parts[0];
        }
        // Find the operator with the lowest precedence (highest value in precedence map)
        let lowestPrecedenceIdx = 0;
        let lowestPrecedenceValue = -1;

        for (let i = 0; i < operators.length; i++) {
            const operator = operators[i];
            const opPrecedence = precedence.get(operator) ?? {
                precedence: Infinity,
                rightAssoc: false
            };

            // For equal precedence, use associativity to determine which operator to pick
            if (opPrecedence.precedence > lowestPrecedenceValue) {
                // Always pick operators with lower precedence (higher precedence value)
                lowestPrecedenceValue = opPrecedence.precedence;
                lowestPrecedenceIdx = i;
            } else if (opPrecedence.precedence === lowestPrecedenceValue) {
                // Check associativity when precedence is equal
                if (!opPrecedence.rightAssoc) {
                    // For left associative operators (default), pick the leftmost one
                    // This means choosing the rightmost equal-precedence operator when working backwards
                    lowestPrecedenceIdx = i;
                }
                // For right associative operators with equal precedence,
                // we keep the previous (rightmost) index
            }
        }

        // Split the expression at the lowest precedence operator
        const leftOperators = operators.slice(0, lowestPrecedenceIdx);
        const rightOperators = operators.slice(lowestPrecedenceIdx + 1);

        const leftParts = parts.slice(0, lowestPrecedenceIdx + 1);
        const rightParts = parts.slice(lowestPrecedenceIdx + 1);

        // Create sub-expressions
        const leftInfix: InfixElement = {
            $infixName: obj.$infixName,
            $type: obj.$type,
            $cstNode: obj.$cstNode,
            parts: leftParts,
            operators: leftOperators
        };
        const rightInfix: InfixElement = {
            $infixName: obj.$infixName,
            $type: obj.$type,
            $cstNode: obj.$cstNode,
            parts: rightParts,
            operators: rightOperators
        };

        // Recursively build the left and right subtrees
        const leftTree = this.constructInfix(leftInfix, precedence);
        const rightTree = this.constructInfix(rightInfix, precedence);

        // Create the final binary expression
        return {
            $type: obj.$type,
            $cstNode: obj.$cstNode,
            left: leftTree,
            operator: operators[lowestPrecedenceIdx],
            right: rightTree
        };
    }

    private getAssignment(feature: AbstractElement): AssignmentElement {
        if (!this.assignmentMap.has(feature)) {
            const assignment = getContainerOfType(feature, isAssignment);
            this.assignmentMap.set(feature, {
                assignment: assignment,
                crossRef: assignment && isCrossReference(assignment.terminal) ? (assignment.terminal.isMulti ? 'multi' : 'single') : undefined
            });
        }
        return this.assignmentMap.get(feature)!;
    }

    private assign(operator: string, feature: string, value: unknown, cstNode: CstNode | undefined, crossRef?: 'multi' | 'single'): void {
        const obj = this.current;
        let item: unknown;
        if (crossRef === 'single' && typeof value === 'string') {
            item = this.linker.buildReference(obj, feature, cstNode, value);
        } else if (crossRef === 'multi' && typeof value === 'string') {
            item = this.linker.buildMultiReference(obj, feature, cstNode, value);
        } else {
            item = value;
        }
        // The assigned node is fully constructed at this point, so we can link its CST node
        this.linkCstNode(item);
        switch (operator) {
            case '=': {
                obj[feature] = item;
                break;
            }
            case '?=': {
                obj[feature] = true;
                break;
            }
            case '+=': {
                if (!Array.isArray(obj[feature])) {
                    obj[feature] = [];
                }
                obj[feature].push(item);
            }
        }
    }

    private assignWithoutOverride(target: any, source: any): any {
        for (const name in source) {
            if (!Object.prototype.hasOwnProperty.call(source, name)) {
                continue;
            }
            const existingValue = source[name];
            const newValue = target[name];
            if (newValue === undefined) {
                target[name] = existingValue;
            } else if (Array.isArray(newValue) && Array.isArray(existingValue)) {
                existingValue.push(...newValue);
                target[name] = existingValue;
            }
        }
        // The target was parsed from a unassigned subrule
        // After the subrule construction, it received a cst node
        // This CST node will later be overriden by the cst node builder
        target.$cstNode = undefined;
        return target;
    }

    get definitionErrors(): IParserDefinitionError[] {
        return this.wrapper.definitionErrors;
    }
}

export interface IParserDefinitionError {
    message: string
    type: number
    ruleName?: string
}

export abstract class AbstractParserErrorMessageProvider implements IParserErrorMessageProvider {

    buildMismatchTokenMessage(options: {
        expected: TokenType
        actual: IToken
        previous: IToken
        ruleName: string
    }): string {
        return defaultParserErrorProvider.buildMismatchTokenMessage(options);
    }

    buildNotAllInputParsedMessage(options: {
        firstRedundant: IToken
        ruleName: string
    }): string {
        return defaultParserErrorProvider.buildNotAllInputParsedMessage(options);
    }

    buildNoViableAltMessage(options: {
        expectedPathsPerAlt: TokenType[][][]
        actual: IToken[]
        previous: IToken
        customUserDescription: string
        ruleName: string
    }): string {
        return defaultParserErrorProvider.buildNoViableAltMessage(options);
    }

    buildEarlyExitMessage(options: {
        expectedIterationPaths: TokenType[][]
        actual: IToken[]
        previous: IToken
        customUserDescription: string
        ruleName: string
    }): string {
        return defaultParserErrorProvider.buildEarlyExitMessage(options);
    }

}

export class LangiumParserErrorMessageProvider extends AbstractParserErrorMessageProvider {

    override buildMismatchTokenMessage({ expected, actual }: {
        expected: TokenType
        actual: IToken
        previous: IToken
        ruleName: string
    }): string {
        const expectedMsg = expected.LABEL
            ? '`' + expected.LABEL + '`'
            : expected.name.endsWith(':KW')
                ? `keyword '${expected.name.substring(0, expected.name.length - 3)}'`
                : `token of type '${expected.name}'`;
        return `Expecting ${expectedMsg} but found \`${actual.image}\`.`;
    }

    override buildNotAllInputParsedMessage({ firstRedundant }: {
        firstRedundant: IToken
        ruleName: string
    }): string {
        return `Expecting end of file but found \`${firstRedundant.image}\`.`;
    }
}

export interface CompletionParserResult {
    tokens: IToken[]
    elementStack: AbstractElement[]
    tokenIndex: number
}

export class LangiumCompletionParser extends AbstractLangiumParser {
    private tokens: IToken[] = [];

    private elementStack: AbstractElement[] = [];
    private lastElementStack: AbstractElement[] = [];
    private nextTokenIndex = 0;
    private stackSize = 0;

    constructor(services: LangiumCoreServices) {
        super(services, true);
    }

    action(): void {
        // NOOP
    }

    construct(): unknown {
        // NOOP
        return undefined;
    }

    parse(input: string): CompletionParserResult {
        this.resetState();
        const tokens = this.lexer.tokenize(input, { mode: 'partial' });
        this.tokens = tokens.tokens;
        this.wrapper.input = [...this.tokens];
        this.mainRule.call(this.wrapper, {});
        this.unorderedGroups.clear();
        return {
            tokens: this.tokens,
            elementStack: [...this.lastElementStack],
            tokenIndex: this.nextTokenIndex
        };
    }

    rule(rule: ParserRule, impl: RuleImpl): RuleResult {
        const ruleMethod = this.wrapper.DEFINE_RULE(withRuleSuffix(rule.name), this.startImplementation(impl).bind(this));
        this.allRules.set(rule.name, ruleMethod);
        if (rule.entry) {
            this.mainRule = ruleMethod;
        }
        return ruleMethod;
    }

    private resetState(): void {
        this.elementStack = [];
        this.lastElementStack = [];
        this.nextTokenIndex = 0;
        this.stackSize = 0;
    }

    private startImplementation(implementation: RuleImpl): RuleImpl {
        return (args) => {
            const size = this.keepStackSize();
            try {
                implementation(args);
            } finally {
                this.resetStackSize(size);
            }
        };
    }

    private removeUnexpectedElements(): void {
        this.elementStack.splice(this.stackSize);
    }

    keepStackSize(): number {
        const size = this.elementStack.length;
        this.stackSize = size;
        return size;
    }

    resetStackSize(size: number): void {
        this.removeUnexpectedElements();
        this.stackSize = size;
    }

    consume(idx: number, tokenType: TokenType, feature: AbstractElement): void {
        this.wrapper.wrapConsume(idx, tokenType);
        if (!this.isRecording()) {
            this.lastElementStack = [...this.elementStack, feature];
            this.nextTokenIndex = this.currIdx + 1;
        }
    }

    subrule(idx: number, rule: RuleResult, fragment: boolean, feature: AbstractElement, args: Args): void {
        this.before(feature);
        this.wrapper.wrapSubrule(idx, rule, args);
        this.after(feature);
    }

    before(element: AbstractElement): void {
        if (!this.isRecording()) {
            this.elementStack.push(element);
        }
    }

    after(element: AbstractElement): void {
        if (!this.isRecording()) {
            const index = this.elementStack.lastIndexOf(element);
            if (index >= 0) {
                this.elementStack.splice(index);
            }
        }
    }

    get currIdx(): number {
        return (this.wrapper as any).currIdx;
    }
}

const defaultConfig: IParserConfig = {
    recoveryEnabled: true,
    nodeLocationTracking: 'full',
    skipValidations: true,
    errorMessageProvider: new LangiumParserErrorMessageProvider()
};

/**
 * This class wraps the embedded actions parser of chevrotain and exposes protected methods.
 * This way, we can build the `LangiumParser` as a composition.
 */
class ChevrotainWrapper extends EmbeddedActionsParser {

    // This array is set in the base implementation of Chevrotain.
    definitionErrors: IParserDefinitionError[];

    constructor(tokens: TokenVocabulary, config: IParserConfig, incomplete: boolean) {
        const useDefaultLookahead = config && 'maxLookahead' in config;
        super(tokens, {
            ...defaultConfig,
            lookaheadStrategy: useDefaultLookahead
                ? new LLkLookaheadStrategy({ maxLookahead: config.maxLookahead })
                : new LLStarLookaheadStrategy({
                    // If validations are skipped, don't log the lookahead warnings
                    logging: config.skipValidations ? () => { } : undefined,
                    incomplete,
                }),
            ...config,
        });
    }

    DEFINE_RULE(name: string, impl: RuleImpl, config?: IRuleConfig<any>): RuleResult {
        return this.RULE(name, impl, config);
    }

    wrapSelfAnalysis(): void {
        this.performSelfAnalysis();
    }

    wrapConsume(idx: number, tokenType: TokenType): IToken {
        return this.consume(idx, tokenType, undefined);
    }

    /**
     * Options object reused by all `wrapSubrule` calls. Chevrotain spreads `ARGS` into the rule invocation
     * synchronously and doesn't keep a reference to the options, so the object can be reused even for nested calls.
     */
    private readonly subruleOptions: { ARGS: [Args] } = { ARGS: [{}] };

    wrapSubrule(idx: number, rule: RuleResult, args: Args): unknown {
        const options = this.subruleOptions;
        options.ARGS[0] = args;
        return this.subrule(idx, rule, options);
    }

    wrapOr(idx: number, choices: Array<IOrAlt<any>>): void {
        this.or(idx, choices);
    }

    wrapOption(idx: number, callback: DSLMethodOpts<unknown>): void {
        this.option(idx, callback);
    }

    wrapMany(idx: number, callback: DSLMethodOpts<unknown>): void {
        this.many(idx, callback);
    }

    wrapAtLeastOne(idx: number, callback: DSLMethodOpts<unknown>): void {
        this.atLeastOne(idx, callback);
    }
    rule(rule: RuleResult): any {
        return rule.call(this, {});
    }
}

class ProfilerWrapper extends ChevrotainWrapper {
    private readonly task: ProfilingTask;
    constructor(tokens: TokenVocabulary, config: IParserConfig, incomplete: boolean, task: ProfilingTask) {
        super(tokens, config, incomplete);
        this.task = task;
    }

    override rule(rule: RuleResult): any {
        this.task.start();
        this.task.startSubTask(this.ruleName(rule));
        try {
            return super.rule(rule);
        }
        finally {
            this.task.stopSubTask(this.ruleName(rule));
            this.task.stop();
        }
    }

    private ruleName(rule: any): string {
        return rule.ruleName as string;
    }
    protected override subrule<ARGS extends unknown[], R>(idx: number, ruleToCall: ParserMethod<ARGS, R>, options?: SubruleMethodOpts<ARGS>): R {
        this.task.startSubTask(this.ruleName(ruleToCall));
        try {
            return super.subrule<ARGS, R>(idx, ruleToCall, options);
        }
        finally {
            this.task.stopSubTask(this.ruleName(ruleToCall));
        }
    }
}
