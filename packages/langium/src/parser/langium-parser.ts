/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbeddedActionsParser, ILexingError, IRecognitionException, IRuleConfig, Lexer, TokenType } from 'chevrotain';
import { AbstractElement, Action, Assignment, isAssignment, isCrossReference, reflection } from '../grammar/generated/ast';
import { LangiumDocument } from '../documents/document';
import { AstNode, Number, Reference, RuleResult, String } from '../syntax-tree';
import { isArrayOperator } from '../grammar/grammar-util';
import { CstNodeBuilder } from './cst-node-builder';
import { GrammarAccess } from '../grammar/grammar-access';
import { Linker } from '../references/linker';
import { LangiumServices } from '../services';

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
    readonly grammarAccess: GrammarAccess;

    private readonly linker: Linker;
    private readonly lexer: Lexer;
    private readonly nodeBuilder = new CstNodeBuilder();
    private stack: StackItem[] = [];
    private mainRule!: RuleResult;

    private get current(): StackItem {
        return this.stack[this.stack.length - 1];
    }

    constructor(tokens: TokenType[], services: LangiumServices) {
        super(tokens, { recoveryEnabled: true, nodeLocationTracking: 'onlyOffset' });
        this.grammarAccess = services.GrammarAccess;
        this.linker = services.references.Linker;
        this.lexer = new Lexer(tokens);
    }

    MAIN_RULE(
        name: string,
        type: string,
        implementation: (...implArgs: unknown[]) => unknown,
        config?: IRuleConfig<unknown>
    ): (idxInCallingRule?: number, ...args: unknown[]) => unknown {
        return this.mainRule = this.DEFINE_RULE(name, type, implementation, config);
    }

    DEFINE_RULE(
        name: string,
        type: string | undefined,
        implementation: (...implArgs: unknown[]) => unknown,
        config?: IRuleConfig<unknown>
    ): (idxInCallingRule?: number, ...args: unknown[]) => unknown {
        return super.RULE(name, this.startImplementation(type, implementation), config);
    }

    parse(input: string, documentUri: string): LangiumDocument {
        this.nodeBuilder.buildRootNode(input);
        const lexerResult = this.lexer.tokenize(input);
        this.input = lexerResult.tokens;
        const result = this.mainRule();
        const document: LangiumDocument = {
            parseResult: {
                value: result,
                lexerErrors: lexerResult.errors,
                parserErrors: this.errors
            },
            documentUri
        };
        result.$document = document;
        return document;
    }

    private startImplementation($type: string | undefined, implementation: (...implArgs: unknown[]) => unknown): (implArgs: unknown[]) => unknown {
        return (implArgs: unknown[]) => {
            if (!this.RECORDING_PHASE) {
                this.stack.push({
                    object: { $type },
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
            const assignment = <Assignment>AstNode.getContainer(feature, reflection, Assignment);
            if (assignment) {
                let crossRefId: string | undefined;
                if (isCrossReference(assignment.terminal)) {
                    crossRefId = `${this.current.object.$type}:${assignment.feature}`;
                }
                this.assign(assignment, token.image, crossRefId);
            }
        }
    }

    unassignedSubrule(idx: number, rule: RuleResult, feature: AbstractElement): void {
        const result = this.subruleLeaf(idx, rule, feature);
        if (!this.RECORDING_PHASE) {
            const resultKind = result.$type;
            const object = Object.assign(result, this.current.object);
            if (resultKind) {
                (<any>object).$type = resultKind;
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
            const assignment = <Assignment>AstNode.getContainer(feature, reflection, Assignment);
            if (assignment) {
                this.assign(assignment, subruleResult);
            }
        }
        return subruleResult;
    }

    executeAction($type: string, action: Action): void {
        if (!this.RECORDING_PHASE && !this.current.executedAction) {
            const last = this.current;
            const newItem: StackItem = {
                object: { $type },
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
    initializeElement(grammarAccessElement: { [key: string]: AbstractElement }): void {
        if (!this.RECORDING_PHASE) {
            // TODO fix this by inverting the assign call in unassignedSubrule
            //const item = this.current.object;
            for (const element of Object.values(grammarAccessElement)) {
                if (isAssignment(element)) {
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
            if (!name.startsWith('$')) {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (typeof (item) === 'object') {
                            item.$container = obj;
                        }
                    }
                } else if (typeof (value) === 'object') {
                    (<any>value).$container = obj;
                }
            }
        }
        this.nodeBuilder.construct(obj);
        this.stack.pop();
        if (String.is(obj)) {
            const node = obj.$cstNode;
            return node.text;
        } else if (Number.is(obj)) {
            const node = obj.$cstNode;
            return parseFloat(<string>node.text);
        }
        return obj;
    }

    private assign(assignment: { operator: string, feature: string }, value: unknown, crossRefId?: string): void {
        const obj = this.current.object;
        const feature = assignment.feature.replace(/\^/g, '');
        const item = crossRefId && typeof value === 'string' ? this.buildReference(obj, value, crossRefId) : value;
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

    private buildReference(node: AstNode, text: string, crossRefId: string): Reference {
        const link = this.linker.link.bind(this.linker);
        const reference: Reference & { _ref?: AstNode } = {
            $refName: text,
            get ref() {
                if (reference._ref === undefined) {
                    // TODO handle linking errors
                    reference._ref = link(node, text, crossRefId);
                }
                return reference._ref;
            }
        };
        return reference;
    }
}
