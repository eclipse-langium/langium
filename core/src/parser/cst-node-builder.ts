import { IToken } from 'chevrotain';
import { AbstractElement } from '../gen/ast';
import { AstNode, CompositeCstNode, CstNode, LeafCstNode, RootCstNode } from '../generator/ast-node';

export class CstNodeBuilder {

    private rootNode!: RootCstNode;
    private nodeStack: CompositeCstNode[] = [];

    private get current(): CompositeCstNode {
        return this.nodeStack[this.nodeStack.length - 1];
    }

    buildRootNode(input: string): void {
        this.rootNode = new RootCstNode(input);
        this.nodeStack.push(this.rootNode);
    }

    buildLeafNode(token: IToken, feature: AbstractElement): void {
        const leafNode = new LeafCstNode(token.startOffset, token.image.length, token.tokenType, false);
        leafNode.feature = feature;
        leafNode.root = this.rootNode;
        this.current.children.push(leafNode);
    }

    newRuleNode(): void {
        this.nodeStack.push(new CompositeCstNode());
    }

    construct(item: { [AstNode.cstNode]: CstNode }): void {
        this.current.element = <AstNode>item;
        item[AstNode.cstNode] = this.reduce(this.current);
        this.nodeStack.pop();
    }

    private reduce(node: CstNode): CstNode {
        if (node instanceof CompositeCstNode && node.children.length === 1 && node.children[0].element === node.element) {
            return this.reduce(node.children[0]);
        } else {
            return node;
        }
    }

    buildCompositeNode(feature: AbstractElement): void {
        const compositeNode = new CompositeCstNode();
        compositeNode.feature = feature;
        compositeNode.root = this.rootNode;
        this.current.children.push(compositeNode);
        this.nodeStack.push(compositeNode);
    }
}
