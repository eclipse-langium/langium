/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbeddedActionsParser, ILexingError, IOrAlt, IRecognitionException, IToken, Lexer, TokenType } from 'chevrotain';
import { LangiumDocument } from '../documents/document';
import { AbstractElement, Action, Assignment, isAssignment, isCrossReference } from '../grammar/generated/ast';
import { AstNode, CompositeCstNode, CstNode, LeafCstNode } from '../syntax-tree';
import { CompositeCstNodeImpl, CstNodeBuilder, LeafCstNodeImpl, RootCstNodeImpl } from './cst-node-builder';
import { Linker } from '../references/linker';
import { LangiumServices } from '../services';
import { getContainerOfType } from '../utils/ast-util';
import { ValueConverter } from './value-converter';
import { IParserConfig } from './parser-config';
import { tokenToRange } from '../utils/cst-util';

export type ParseResult<T = AstNode> = {
    value: T,
    parserErrors: IRecognitionException[],
    lexerErrors: ILexingError[]
}

export const DatatypeSymbol = Symbol('Datatype');

type RuleResult = () => any;

interface AssignmentElement {
    assignment?: Assignment
    crossRef: boolean
}

export class LangiumParser {
    private readonly linker: Linker;
    private readonly converter: ValueConverter;
    private readonly lexer: Lexer;
    private readonly nodeBuilder = new CstNodeBuilder();
    private readonly wrapper: ChevrotainWrapper;
    private stack: any[] = [];
    private mainRule!: RuleResult;
    private assignmentMap = new Map<AbstractElement, AssignmentElement | undefined>();

    private get current(): any {
        return this.stack[this.stack.length - 1];
    }

    constructor(services: LangiumServices, tokens: TokenType[]) {
        this.wrapper = new ChevrotainWrapper(tokens, services.parser.ParserConfig);
        this.linker = services.references.Linker;
        this.converter = services.parser.ValueConverter;
        this.lexer = new Lexer(tokens);
    }

    MAIN_RULE(
        name: string,
        type: string | symbol | undefined,
        implementation: () => unknown
    ): () => unknown {
        return this.mainRule = this.DEFINE_RULE(name, type, implementation);
    }

    DEFINE_RULE(
        name: string,
        type: string | symbol | undefined,
        implementation: () => unknown
    ): () => unknown {
        return this.wrapper.DEFINE_RULE(name, this.startImplementation(type, implementation).bind(this));
    }

    parse<T extends AstNode = AstNode>(input: string | LangiumDocument<T>): ParseResult<T> {
        const text = typeof input === 'string' ? input : input.textDocument.getText();
        this.nodeBuilder.buildRootNode(text);
        const lexerResult = this.lexer.tokenize(text);
        this.wrapper.input = lexerResult.tokens;
        const result = this.mainRule.call(this.wrapper);
        this.addHiddenTokens(result.$cstNode, lexerResult.groups.hidden);
        if (typeof input !== 'string') {
            result.$document = input;
        }
        return {
            value: result,
            lexerErrors: lexerResult.errors,
            parserErrors: this.wrapper.errors
        };
    }

    private addHiddenTokens(node: RootCstNodeImpl, tokens: IToken[]): void {
        for (const token of tokens) {
            const hiddenNode = new LeafCstNodeImpl(token.startOffset, token.image.length, tokenToRange(token), token.tokenType, true);
            hiddenNode.root = node;
            this.addHiddenToken(node, hiddenNode);
        }
    }

    private addHiddenToken(node: CompositeCstNode, token: LeafCstNode): void {
        const { offset, end } = node;
        const { offset: tokenStart, end: tokenEnd } = token;
        if (offset >= tokenEnd) {
            node.children.unshift(token);
        } else if (end <= tokenStart) {
            node.children.push(token);
        } else {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                const childEnd = child.end;
                if (child instanceof CompositeCstNodeImpl && tokenEnd < childEnd) {
                    this.addHiddenToken(child, token);
                    return;
                } else if (tokenEnd <= child.offset) {
                    node.children.splice(i, 0, token);
                    return;
                }
            }
        }
    }

    private startImplementation($type: string | symbol | undefined, implementation: () => unknown): () => unknown {
        return () => {
            if (!this.wrapper.IS_RECORDING) {
                this.stack.push({ $type });
            }
            let result: unknown;
            try {
                result = implementation();
            } catch (err) {
                console.log('Parser exception thrown!', err);
                result = undefined;
            }
            if (!this.wrapper.IS_RECORDING && result === undefined) {
                result = this.construct();
            }
            return result;
        };
    }

    alternatives(idx: number, choices: Array<() => void>): void {
        this.wrapper.wrapOr(idx, choices);
    }

    optional(idx: number, callback: () => void): void {
        this.wrapper.wrapOption(idx, callback);
    }

    many(idx: number, callback: () => void): void {
        this.wrapper.wrapMany(idx, callback);
    }

    atLeastOne(idx: number, callback: () => void): void {
        this.wrapper.wrapAtLeastOne(idx, callback);
    }

    consume(idx: number, tokenType: TokenType, feature: AbstractElement): void {
        const token = this.wrapper.wrapConsume(idx, tokenType);
        if (!this.wrapper.IS_RECORDING) {
            const leafNode = this.nodeBuilder.buildLeafNode(token, feature);
            const { assignment, crossRef } = this.getAssignment(feature);
            if (assignment) {
                let crossRefId: string | undefined;
                if (crossRef) {
                    crossRefId = `${this.current.$type}:${assignment.feature}`;
                }
                this.assign(assignment, token.image, leafNode, crossRefId);
            }
        }
    }

    unassignedSubrule(idx: number, rule: RuleResult, feature: AbstractElement): void {
        const result = this.subrule(idx, rule, feature);
        if (!this.wrapper.IS_RECORDING) {
            const resultKind = result.$type;
            const object = this.assignWithoutOverride(result, this.current);
            if (resultKind) {
                object.$type = resultKind;
            }
            const newItem = object;
            this.stack.pop();
            this.stack.push(newItem);
        }
    }

    subrule(idx: number, rule: RuleResult, feature: AbstractElement): any {
        let cstNode: CompositeCstNode | undefined;
        if (!this.wrapper.IS_RECORDING) {
            cstNode = this.nodeBuilder.buildCompositeNode(feature);
        }
        const subruleResult = this.wrapper.wrapSubrule(idx, rule);
        if (!this.wrapper.IS_RECORDING) {
            const { assignment, crossRef } = this.getAssignment(feature);
            if (assignment && cstNode) {
                let crossRefId: string | undefined;
                if (crossRef) {
                    crossRefId = `${this.current.$type}:${assignment.feature}`;
                }
                this.assign(assignment, subruleResult, cstNode, crossRefId);
            }
        }
        return subruleResult;
    }

    action($type: string, action: Action): void {
        if (!this.wrapper.IS_RECORDING) {
            let last = this.current;
            // This branch is used for left recursive grammar rules.
            // Those don't call `construct` before another action.
            // Therefore, we need to call it here.
            if (!last.$cstNode && action.feature && action.operator) {
                last = this.construct(false);
                const feature = last.$cstNode.feature;
                this.nodeBuilder.buildCompositeNode(feature);
            }
            const newItem = { $type };
            this.stack.pop();
            this.stack.push(newItem);
            if (action.feature && action.operator) {
                this.assign(action, last, last.$cstNode);
            }
        }
    }

    /**
     * Initializes array fields of the current object. Array fields are not allowed to be undefined.
     * Therefore, all array fields are initialized with an empty array.
     * @param initialArrayProperties The grammar access element that belongs to the current rule
     */
    initializeElement(initialArrayProperties: string[]): void {
        if (!this.wrapper.IS_RECORDING) {
            const item = this.current;
            for (const element of initialArrayProperties) {
                item[element] = [];
            }
        }
    }

    construct(pop = true): unknown {
        if (this.wrapper.IS_RECORDING) {
            return undefined;
        }
        const obj = this.current;
        for (const [name, value] of Object.entries(obj)) {
            if (!name.startsWith('$')) {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (item !== null && typeof item === 'object') {
                            item.$container = obj;
                        }
                    }
                } else if (obj !== null && typeof (value) === 'object') {
                    (<any>value).$container = obj;
                }
            }
        }
        this.nodeBuilder.construct(obj);
        if (pop) {
            this.stack.pop();
        }
        if (obj.$type === DatatypeSymbol) {
            const node = obj.$cstNode;
            return node.text;
        }
        return obj;
    }

    private getAssignment(feature: AbstractElement): AssignmentElement {
        if (!this.assignmentMap.has(feature)) {
            const assignment = getContainerOfType(feature, isAssignment);
            this.assignmentMap.set(feature, {
                assignment: assignment,
                crossRef: assignment ? isCrossReference(assignment.terminal) : false
            });
        }
        return this.assignmentMap.get(feature)!;
    }

    private assign(assignment: { operator: string, feature: string }, value: unknown, cstNode: CstNode, crossRefId?: string): void {
        const obj = this.current;
        const feature = assignment.feature.replace(/\^/g, '');
        let item: unknown;
        if (crossRefId && typeof value === 'string') {
            item = this.linker.buildReference(obj, cstNode, crossRefId, value);
        } else if (cstNode && typeof value === 'string') {
            item = this.converter.convert(value, cstNode);
        } else {
            item = value;
        }
        switch (assignment.operator) {
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
        for (const [name, value] of Object.entries(source)) {
            if (target[name] === undefined) {
                target[name] = value;
            }
        }
        return target;
    }

    finalize(): void {
        this.wrapper.wrapSelfAnalysis();
    }
}

const defaultConfig: IParserConfig = {
    recoveryEnabled: true,
    nodeLocationTracking: 'full',
    skipValidations: true
};

/**
 * This class wraps the embedded actions parser of chevrotain and exposes protected methods.
 * This way, we can build the `LangiumParser` as a composition.
 */
class ChevrotainWrapper extends EmbeddedActionsParser {

    constructor(tokens: TokenType[], config?: IParserConfig) {
        super(tokens, {
            ...defaultConfig,
            ...config
        });
    }

    get IS_RECORDING(): boolean {
        return this.RECORDING_PHASE;
    }

    DEFINE_RULE(name: string, impl: () => unknown): () => unknown {
        return this.RULE(name, impl);
    }

    wrapSelfAnalysis(): void {
        this.performSelfAnalysis();
    }

    wrapConsume(idx: number, tokenType: TokenType): IToken {
        return this.consume(idx, tokenType);
    }

    wrapSubrule(idx: number, rule: RuleResult): unknown {
        return this.subrule(idx, rule);
    }

    wrapOr(idx: number, choices: Array<() => void>): void {
        this.or(idx, choices.map(e => <IOrAlt<any>>{ ALT: e }));
    }

    wrapOption(idx: number, callback: () => void): void {
        this.option(idx, callback);
    }

    wrapMany(idx: number, callback: () => void): void {
        this.many(idx, callback);
    }

    wrapAtLeastOne(idx: number, callback: () => void): void {
        this.atLeastOne(idx, callback);
    }
}
