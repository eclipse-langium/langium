import { EmbeddedActionsParser, IRuleConfig, TokenType } from "chevrotain";
import { PartialDeep } from "type-fest";
import { Action } from "../gen/ast";
import { AstNode, CompositeNode, INode, LeafNode, RootNode, RuleResult } from "../generator/ast-node";
import { Feature } from "../generator/utils";
import { getTypeName } from "../grammar/grammar-utils";

type StackItem = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any,
    nodes: INode[],
    executedAction: boolean,
    feature?: Feature
}

export class LangiumParser extends EmbeddedActionsParser {

    private stack: StackItem[] = [];
    private mainRule!: (idxInCallingRule?: number, ...args: unknown[]) => unknown;

    private get current(): StackItem {
        return this.stack[this.stack.length - 1];
    }

    constructor(tokens: TokenType[]) {
        super(tokens, { recoveryEnabled: true, nodeLocationTracking: 'onlyOffset' });
    }

    MAIN_RULE<T>(
        name: string,
        typeName: string,
        implementation: (...implArgs: unknown[]) => T,
        config?: IRuleConfig<T>
    ): (idxInCallingRule?: number, ...args: unknown[]) => T {
        return this.mainRule = this.DEFINE_RULE(name, typeName, implementation, config);
    }

    DEFINE_RULE<T>(
        name: string,
        typeName: string,
        implementation: (...implArgs: unknown[]) => T,
        config?: IRuleConfig<T>
    ): (idxInCallingRule?: number, ...args: unknown[]) => T {
        return super.RULE(name, this.startImplementation(typeName, implementation), config);
    }

    parse<T extends AstNode>(): T {
        let result = this.mainRule();
        if (!result && this.stack.length > 0) {
            result = this.reconstruct();
        }

        return <T>result;
    }

    private reconstruct<T extends AstNode>(): unknown {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lastResult: any = undefined;
        while (this.stack.length > 0) {
            const feature = this.stack[this.stack.length - 1].feature;
            result = this.construct<T>();
            if (feature) {
                if (feature.kind === "RuleCall") {
                    result = {...result, ...lastResult};
                } else if (feature.kind === "Assignment") {
                    this.assign({ operator: feature.Operator, feature: feature.Feature }, lastResult, result);
                }
            }
            if (lastResult) {
                const lastCstNode = lastResult[AstNode.node] as CompositeNode;
                const cstNode = result[AstNode.node] as CompositeNode;
                if (lastCstNode !== cstNode) {
                    lastCstNode.children.forEach(e => {
                        e.parent = cstNode;
                    });
                    cstNode.children.push(lastCstNode);
                }
            }
            lastResult = result;
        }
        return result;
    }

    private startImplementation<T>(typeName: string, implementation: (...implArgs: unknown[]) => T): (implArgs: unknown[]) => T {
        return (implArgs: unknown[]): T => {
            this.stack.push({
                object: { kind: typeName },
                nodes: [],
                executedAction: false
            });
            const result = implementation(implArgs);
            return result;
        }
    }

    consumeLeaf(idx: number, tokenType: TokenType, feature: Feature): void {
        const token = this.consume(idx, tokenType);
        const node = new LeafNode(token.startOffset, token.image.length, false);
        node.element = feature;
        this.current.nodes.push(node);
        if (!this.RECORDING_PHASE && feature.kind === "Assignment") {
            this.assign({ operator: feature.Operator, feature: feature.Feature }, token.image);
        }
    }

    unassignedSubrule<T extends AstNode>(idx: number, rule: RuleResult<T>, feature: Feature): void {
        const result = this.subruleLeaf(idx, rule, feature);
        const newItem = { ...this.current, object: result };
        this.stack.pop();
        this.stack.push(newItem);
    }

    subruleLeaf<T extends AstNode>(idx: number, rule: RuleResult<T>, feature: Feature): PartialDeep<T> {
        this.current.feature = feature;
        const subruleResult = this.subrule(idx, rule);
        const resultNode = subruleResult[AstNode.node];
        if (resultNode) {
            resultNode.element = feature;
            this.current.nodes.push(<INode>resultNode);
        }
        if (!this.RECORDING_PHASE && feature.kind === "Assignment") {
            this.assign({ operator: feature.Operator, feature: feature.Feature }, subruleResult);
        }
        return subruleResult;
    }

    executeAction(action: Action): void {
        if (!this.RECORDING_PHASE && !this.current.executedAction) {
            const last = this.current;
            const newItem = {
                ...last,
                object: { kind: getTypeName(action.Type) },
                executedAction: true
            };
            this.stack.pop();
            this.stack.push(newItem);
            if (action.Feature && action.Operator) {
                this.assign({ operator: action.Operator, feature: action.Feature }, last.object);
            }
        }
    }

    construct<T extends AstNode>(): PartialDeep<T> {
        const node = this.stack.length === 1 ? new RootNode() : new CompositeNode();
        const item = this.current;
        const obj = { [AstNode.node]: node, ...item.object };
        if (!this.RECORDING_PHASE) {
            for (const value of Object.values(obj)) {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (typeof (item) === "object") {
                            item.container = obj;
                        }
                    }
                } else if (typeof (value) === "object") {
                    (<AstNode>value).container = obj;
                }
            }
            item.nodes.forEach(e => {
                e.parent = node;
            });
            node.children.push(...item.nodes);
        }
        this.stack.pop();
        return <PartialDeep<T>>obj;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private assign(assignment: { operator: string, feature: string }, value: unknown, object?: { [k: string]: any }): void {
        const obj = object ?? this.current.object;
        const feature = assignment.feature.replace(/\^/g, "");
        switch (assignment.operator) {
            case "=": {
                obj[feature] = value;
                break;
            }
            case "?=": {
                obj[feature] = true;
                break;
            }
            case "+=": {
                if (!Array.isArray(obj[feature])) {
                    obj[feature] = [];
                }
                obj[feature].push(value);
            }
        }
    }
}