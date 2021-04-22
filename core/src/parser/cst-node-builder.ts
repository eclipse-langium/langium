import { IToken } from "chevrotain";
import { AbstractElement } from "../gen/ast";
import { AstNode, CompositeCstNode, CstNode, LeafCstNode, RootCstNode } from "../generator/ast-node";

type StackItem = {
    node: CompositeCstNode;
    skip: boolean;
}

export class CstNodeBuilder {

    private nodeStack: StackItem[] = [];
    private rootNode!: RootCstNode;
    private lastNode!: CompositeCstNode;

    private get current(): StackItem {
        return this.nodeStack[this.nodeStack.length - 1];
    }

    buildRootNode(input: string): void {
        this.rootNode = new RootCstNode();
        this.rootNode.text = input;
        this.nodeStack.push({ node: this.rootNode, skip: false });
    }

    buildLeafNode(token: IToken, feature: AbstractElement): void {
        const leafNode = new LeafCstNode(token.startOffset, token.image.length, false);
        leafNode.feature = feature;
        this.current.node.children.push(leafNode);
    }

    newRuleNode(): void {
        if (this.nodeStack.length === 0) {
            this.nodeStack.push({ node: this.rootNode, skip: false });
        } else {
            const node = new CompositeCstNode();
            this.nodeStack.push({ node, skip: false });
        }
    }

    skipNextConstruction(): void {
        this.current.skip = true;
    }

    construct(item: { [AstNode.cstNode]: CstNode }): void {
        this.current.node.element = <AstNode>item;
        item[AstNode.cstNode] = this.reduce(this.current.node);
        // const lastNode = this.current.node;
        if (this.current.skip) {
            this.nodeStack.pop();
            // this.current.node.children.push(...lastNode.children);
        } else {
            this.nodeStack.pop();
            // if (this.nodeStack.length > 0) {
            // }
        }
    }

    private reduce(node: CstNode): CstNode {
        if (node instanceof CompositeCstNode && node.children.length === 1 && node.children[0].element === node.element) {
            return this.reduce(node.children[0]);
        } else {
            return node;
        }
    }

    continueLastNode(feature: AbstractElement): void {
        const last = this.lastNode;
        last.feature = feature;
        this.nodeStack.push({ node: last, skip: false });
    }

    appendLastNode(feature: AbstractElement): void {
        this.lastNode.feature = feature;
        this.current.node.children.push(this.lastNode);
    }

    buildCompositeNode(feature: AbstractElement): void {
        const compositeNode = new CompositeCstNode();
        compositeNode.feature = feature;
        this.current.node.children.push(compositeNode);
        this.nodeStack.push({ node: compositeNode, skip: false });
    }
}
