import { EmbeddedActionsParser, IRuleConfig, TokenType } from "chevrotain";
import { PartialDeep } from "type-fest";
import { Action, Grammar } from "../gen/ast";
import { AstNode, CompositeNode, INode, LeafNode, RootNode, RuleResult } from "../generator/ast-node";
import { Feature } from "../generator/utils";

export class LangiumParser extends EmbeddedActionsParser {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private objStack: any[] = [];
    private nodeStack: INode[][] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get currentObject(): any {
        return this.objStack[this.objStack.length - 1];
    }

    private get currentNodes(): INode[] {
        return this.nodeStack[this.nodeStack.length - 1];
    }

    grammar: Grammar;

    constructor(grammar: Grammar, tokens: TokenType[]) {
        super(tokens, { recoveryEnabled: true, nodeLocationTracking: 'onlyOffset' });
        this.grammar = grammar;
    }

    RULE<T>(
        name: string,
        implementation: (...implArgs: unknown[]) => T,
        config?: IRuleConfig<T>
    ): (idxInCallingRule?: number, ...args: unknown[]) => T {
        return super.RULE(name, this.startImplementation(implementation), config);
    }

    private startImplementation<T>(implementation: (...implArgs: unknown[]) => T): (implArgs: unknown[]) => T {
        return (implArgs: unknown[]): T => {
            this.objStack.push({});
            this.nodeStack.push([]);
            const result = implementation(implArgs);
            this.objStack.pop();
            this.nodeStack.pop();
            return result;
        }
    }

    consumeLeaf(idx: number, tokenType: TokenType, feature: Feature): void {
        const token = this.consume(idx, tokenType);
        const node = new LeafNode(token.startOffset, token.image.length, false);
        node.element = feature;
        this.currentNodes.push(node);
        if (feature.kind === "Assignment") {
            this.assign({ operator: feature.Operator, feature: feature.Feature }, token.image);
        }
    }

    unassignedSubrule<T extends AstNode>(idx: number, rule: RuleResult<T>, feature: Feature): void {
        const result = this.subruleLeaf(idx, rule, feature);
        this.objStack.pop();
        this.objStack.push(result);
    }

    subruleLeaf<T extends AstNode>(idx: number, rule: RuleResult<T>, feature: Feature): PartialDeep<T> {
        const subruleResult = this.subrule(idx, rule);
        const resultNode = subruleResult[AstNode.node];
        if (resultNode) {
            resultNode.element = feature;
            this.currentNodes.push(<INode>resultNode);
        }
        if (feature.kind === "Assignment") {
            this.assign({ operator: feature.Operator, feature: feature.Feature }, subruleResult);
        }
        return subruleResult;
    }

    executeAction(action: Action): void {
        const current = this.objStack.pop();
        const newItem = {};
        this.objStack.push(newItem);
        if (action.Feature && action.Operator) {
            this.assign({ operator: action.Operator, feature: action.Feature }, current);
        }
    }

    construct<T extends AstNode>(kind: string, root?: boolean): PartialDeep<T> {
        const node = root ? new RootNode() : new CompositeNode();
        const obj = { kind, [AstNode.node]: node, ...this.currentObject };
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
            this.currentNodes.forEach(e => {
                e.parent = node;
            });
            node.children.push(...this.currentNodes);
        }
        return <PartialDeep<T>>obj;
    }

    assign(assignment: { operator: string, feature: string }, value: unknown): void {
        const obj = this.currentObject;
        const feature = assignment.feature.replace(/\^/g, "");
        if (Object.isExtensible(obj)) {
            switch (assignment.operator) {
                case "=": {
                    this.currentObject[feature] = value;
                    break;
                }
                case "?=": {
                    this.currentObject[feature] = true;
                    break;
                }
                case "+=": {
                    if (!Array.isArray(this.currentObject[feature])) {
                        this.currentObject[feature] = [];
                    }
                    this.currentObject[feature].push(value);
                }
            }
        }
    }
}