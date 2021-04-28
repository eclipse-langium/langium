/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbeddedActionsParser, IRuleConfig, TokenType } from 'chevrotain';
import { AbstractElement, Action, Assignment, CrossReference, RuleCall } from '../gen/ast';
import { AstNode, CompositeCstNode, Kind, Number, RuleResult, String } from '../generator/ast-node';
import { isArrayOperator } from '../generator/utils';
import { CstNodeBuilder } from './cst-node-builder';

type StackItem = {
    object: any,
    executedAction: boolean,
    unassignedRuleCall: boolean,
    feature?: AbstractElement
}

export class LangiumParser extends EmbeddedActionsParser {

    private stack: StackItem[] = [];
    private nodeBuilder = new CstNodeBuilder();
    private mainRule!: RuleResult;

    private get current(): StackItem {
        return this.stack[this.stack.length - 1];
    }

    constructor(tokens: TokenType[]) {
        super(tokens, { recoveryEnabled: true, nodeLocationTracking: 'onlyOffset' });
    }

    MAIN_RULE<T>(
        name: string,
        kind: Kind,
        implementation: (...implArgs: unknown[]) => T,
        config?: IRuleConfig<T>
    ): (idxInCallingRule?: number, ...args: unknown[]) => T {
        return this.mainRule = this.DEFINE_RULE(name, kind, implementation, config);
    }

    DEFINE_RULE<T>(
        name: string,
        kind: Kind | undefined,
        implementation: (...implArgs: unknown[]) => T,
        config?: IRuleConfig<T>
    ): (idxInCallingRule?: number, ...args: unknown[]) => T {
        return super.RULE(name, this.startImplementation(kind, implementation), config);
    }

    parse<T extends AstNode>(input: string): T {
        this.nodeBuilder = new CstNodeBuilder();
        this.nodeBuilder.buildRootNode(input);
        let result = this.mainRule();
        if (!result && this.stack.length > 0) {
            result = this.reconstruct();
        }

        return <T>result;
    }

    private reconstruct(): unknown {
        let result: any;
        let lastResult: any = undefined;
        while (this.stack.length > 0) {
            const feature = this.stack[this.stack.length - 1].feature;
            result = this.construct();
            if (feature) {
                if (RuleCall.is(feature)) {
                    result = {...result, ...lastResult};
                } else if (Assignment.is(feature)) {
                    this.assign(feature, lastResult, result);
                }
            }
            if (lastResult) {
                const lastCstNode = lastResult[AstNode.cstNode] as CompositeCstNode;
                const cstNode = result[AstNode.cstNode] as CompositeCstNode;
                if (lastCstNode !== cstNode) {
                    for (const child of lastCstNode.children) {
                        (<any>child).parent = cstNode;
                    }
                    cstNode.children.push(lastCstNode);
                }
            }
            lastResult = result;
        }
        return result;
    }

    private startImplementation<T>(kind: Kind | undefined, implementation: (...implArgs: unknown[]) => T): (implArgs: unknown[]) => T {
        return (implArgs: unknown[]): T => {
            if (!this.RECORDING_PHASE) {
                this.stack.push({
                    object: { kind },
                    executedAction: false,
                    unassignedRuleCall: false
                });
            }
            const result = implementation(implArgs);
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
            const newItem = { ...this.current, object, unassignedRuleCall: true };
            this.stack.pop();
            this.stack.push(newItem);
        }
    }

    subruleLeaf(idx: number, rule: RuleResult, feature: AbstractElement): any {
        if (!this.RECORDING_PHASE) {
            this.current.feature = feature;
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
            const newItem = {
                ...last,
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
        for (const value of Object.values(obj)) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private assign(assignment: { operator: string, feature: string }, value: unknown, object?: any): void {
        const obj = object ?? this.current.object;
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
