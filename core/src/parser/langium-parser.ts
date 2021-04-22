/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbeddedActionsParser, IRuleConfig, TokenType } from 'chevrotain';
import { PartialDeep } from 'type-fest';
import { AbstractElement, Action, Assignment, CrossReference, RuleCall } from '../gen/ast';
import { AstNode, CompositeCstNode, Kind, RuleResult } from '../generator/ast-node';
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
    private mainRule!: (idxInCallingRule?: number, ...args: unknown[]) => unknown;

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

    private reconstruct<T extends AstNode>(): unknown {
        let result: any;
        let lastResult: any = undefined;
        while (this.stack.length > 0) {
            const feature = this.stack[this.stack.length - 1].feature;
            result = this.construct<T>();
            if (feature) {
                if (RuleCall.is(feature)) {
                    result = {...result, ...lastResult};
                } else if (Assignment.is(feature)) {
                    this.assign({ operator: feature.operator, feature: feature.feature }, lastResult, result);
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
            this.stack.push({
                object: { kind },
                executedAction: false,
                unassignedRuleCall: false
            });
            const result = implementation(implArgs);
            return result;
        }
    }

    consumeLeaf(idx: number, tokenType: TokenType, feature: AbstractElement): void {
        const token = this.consume(idx, tokenType);
        if (!this.RECORDING_PHASE) {
            this.nodeBuilder.buildLeafNode(token, feature);
        }
        if (!this.RECORDING_PHASE && Assignment.is(feature) && !CrossReference.is(feature.terminal)) {
            this.assign({ operator: feature.operator, feature: feature.feature }, token.image);
        }
    }

    unassignedSubrule<T extends AstNode>(idx: number, rule: RuleResult<T>, feature: AbstractElement): void {
        const result = this.subruleLeaf(idx, rule, feature);
        const resultKind = result.kind;
        let object = result;
        if (!this.RECORDING_PHASE) {
            object = Object.assign(result, this.current.object);
        }
        if (resultKind && !this.RECORDING_PHASE) {
            (<any>object).kind = resultKind;
        }
        const newItem = { ...this.current, object, unassignedRuleCall: true };
        this.stack.pop();
        this.stack.push(newItem);
    }

    subruleLeaf<T extends AstNode>(idx: number, rule: RuleResult<T>, feature: AbstractElement): PartialDeep<T> {
        this.current.feature = feature;
        if (!this.RECORDING_PHASE) {
            this.nodeBuilder.buildCompositeNode(feature);
        }
        const subruleResult = this.subrule(idx, rule);
        if (!this.RECORDING_PHASE && Assignment.is(feature)) {
            this.assign({ operator: feature.operator, feature: feature.feature }, subruleResult);
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
                this.assign({ operator: action.operator, feature: action.feature }, last.object);
            }
        }
    }

    construct<T extends AstNode>(): PartialDeep<T> {
        const item = this.current;
        const obj = item.object
        if (!this.RECORDING_PHASE) {
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
        }
        this.stack.pop();
        return <PartialDeep<T>>obj;
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
