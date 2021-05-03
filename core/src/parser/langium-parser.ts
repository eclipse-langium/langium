/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbeddedActionsParser, ILexingError, IRecognitionException, IRuleConfig, Lexer, TokenType } from 'chevrotain';
import { AbstractElement, Action, Assignment, CrossReference } from '../gen/ast';
import { AstNode, Kind, Number, RuleResult, String } from '../generator/ast-node';
import { isArrayOperator } from '../generator/utils';
import { CstNodeBuilder } from './cst-node-builder';

type StackItem = {
    object: any,
    executedAction: boolean
}

export type ParseResult<T> = {
    value: T,
    parserErrors: IRecognitionException[],
    lexerErrors: ILexingError[]
}

export class LangiumParser extends EmbeddedActionsParser {

    private stack: StackItem[] = [];
    private nodeBuilder = new CstNodeBuilder();
    private mainRule!: RuleResult;
    private lexer: Lexer;

    private get current(): StackItem {
        return this.stack[this.stack.length - 1];
    }

    constructor(tokens: TokenType[]) {
        super(tokens, { recoveryEnabled: true, nodeLocationTracking: 'onlyOffset' });
        this.lexer = new Lexer(tokens);
    }

    MAIN_RULE(
        name: string,
        kind: Kind,
        implementation: (...implArgs: unknown[]) => unknown,
        config?: IRuleConfig<unknown>
    ): (idxInCallingRule?: number, ...args: unknown[]) => unknown {
        return this.mainRule = this.DEFINE_RULE(name, kind, implementation, config);
    }

    DEFINE_RULE(
        name: string,
        kind: Kind | undefined,
        implementation: (...implArgs: unknown[]) => unknown,
        config?: IRuleConfig<unknown>
    ): (idxInCallingRule?: number, ...args: unknown[]) => unknown {
        return super.RULE(name, this.startImplementation(kind, implementation), config);
    }

    parse<T extends AstNode>(input: string): ParseResult<T> {
        this.nodeBuilder.buildRootNode(input);
        const lexerResult = this.lexer.tokenize(input);
        this.input = lexerResult.tokens;
        const result = this.mainRule();
        return {
            value: <T>result,
            lexerErrors: lexerResult.errors,
            parserErrors: this.errors
        };
    }

    private startImplementation(kind: Kind | undefined, implementation: (...implArgs: unknown[]) => unknown): (implArgs: unknown[]) => unknown {
        return (implArgs: unknown[]) => {
            if (!this.RECORDING_PHASE) {
                this.stack.push({
                    object: { kind },
                    executedAction: false
                });
            }
            let result: unknown;
            try {
                result = implementation(implArgs);
            } catch (err) {
                console.log('Parser exception thrown!', err);
                result = undefined;
            }
            if (!this.RECORDING_PHASE && !result) {
                result = this.construct();
            }
            return result;
        };
    }

    consumeLeaf(idx: number, tokenType: TokenType, feature: AbstractElement): void {
        const token = this.consume(idx, tokenType);
        if (!this.RECORDING_PHASE) {
            this.nodeBuilder.buildLeafNode(token, feature);
            const assignment = <Assignment>AstNode.getContainer(feature, Assignment.kind);
            if (assignment && !CrossReference.is(assignment.terminal)) {
                this.assign(assignment, token.image);
            }
        }
    }

    unassignedSubrule(idx: number, rule: RuleResult, feature: AbstractElement): void {
        const result = this.subruleLeaf(idx, rule, feature);
        if (!this.RECORDING_PHASE) {
            const resultKind = result.kind;
            const object = Object.assign(result, this.current.object);
            if (resultKind) {
                (<any>object).kind = resultKind;
            }
            const newItem = { ...this.current, object };
            this.stack.pop();
            this.stack.push(newItem);
        }
    }

    subruleLeaf(idx: number, rule: RuleResult, feature: AbstractElement): any {
        if (!this.RECORDING_PHASE) {
            this.nodeBuilder.buildCompositeNode(feature);
        }
        const subruleResult = this.subrule(idx, rule);
        if (!this.RECORDING_PHASE) {
            const assignment = <Assignment>AstNode.getContainer(feature, Assignment.kind);
            if (assignment) {
                this.assign(assignment, subruleResult);
            }
        }
        return subruleResult;
    }

    executeAction(kind: Kind, action: Action): void {
        if (!this.RECORDING_PHASE && !this.current.executedAction) {
            const last = this.current;
            const newItem: StackItem = {
                object: { kind },
                executedAction: true
            };
            this.stack.pop();
            this.stack.push(newItem);
            if (action.feature && action.operator) {
                this.assign(action, last.object);
            }
        }
    }

    /**
     * Initializes array fields of the current object. Array fields are not allowed to be undefined.
     * Therefore, all array fields are initialized with an empty array.
     * @param grammarAccessElement The grammar access element that belongs to the current rule
     */
    initialize(grammarAccessElement: { [key: string]: AbstractElement }): void {
        if (!this.RECORDING_PHASE) {
            // TODO fix this by inverting the assign call in unassignedSubrule
            //const item = this.current.object;
            for (const element of Object.values(grammarAccessElement)) {
                if (Assignment.is(element)) {
                    if (isArrayOperator(element.operator)) {
                        //item[element.feature] = [];
                    }
                }
            }
        }
    }

    construct(): unknown {
        if (this.RECORDING_PHASE) {
            return undefined;
        }
        const item = this.current;
        const obj = item.object;
        for (const [name, value] of Object.entries(obj)) {
            if (name !== 'kind') {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (typeof (item) === 'object') {
                            item.container = obj;
                        }
                    }
                } else if (typeof (value) === 'object') {
                    (<any>value).container = obj;
                }
            }
        }
        this.nodeBuilder.construct(obj);
        this.stack.pop();
        if (String.is(obj)) {
            const node = obj[AstNode.cstNode];
            return node.text;
        } else if (Number.is(obj)) {
            const node = obj[AstNode.cstNode];
            return parseFloat(<string>node.text);
        }
        return obj;
    }

    private assign(assignment: { operator: string, feature: string }, value: unknown): void {
        const obj = this.current.object;
        const feature = assignment.feature.replace(/\^/g, '');
        switch (assignment.operator) {
            case '=': {
                obj[feature] = value;
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
                obj[feature].push(value);
            }
        }
    }
}
