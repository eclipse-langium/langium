import { PartialDeep } from "type-fest"
import { Any } from "../gen/ast";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AstNode {
    export const node = Symbol("node");
}

export type AstNode = {
    kind: string,
    container: AstNode,
    [AstNode.node]: INode,
    '.references': Map<string, string | undefined>,
}

export interface INode {
    parent?: ICompositeNode;
    getOffset(): number;
    getLength(): number;
    element: Any;
    getText(): string;
    getRoot(): RootNode;
}

export abstract class AbstractNode implements INode {
    abstract getOffset(): number;
    abstract getLength(): number;
    parent?: ICompositeNode;
    element!: Any;

    getText(): string {
        const offset = this.getOffset();
        return this.getRoot().getText().substring(offset, offset + this.getLength());
    }

    getRoot(): RootNode {
        const parent = this.parent;
        if (parent instanceof RootNode) {
            return parent;
        } else if (parent) {
            return parent.getRoot();
        } else {
            throw new Error("Node has no root");
        }
    }
}

export interface ICompositeNode extends INode {
    children: INode[];
}

export interface ILeafNode extends INode {
    hidden: boolean;
}

export class LeafNode extends AbstractNode implements ILeafNode {
    getOffset(): number {
        return this.offset;
    }
    getLength(): number {
        return this.length;
    }
    hidden = false;

    private offset: number;
    private length: number;

    constructor(offset: number, length: number, hidden = false) {
        super();
        this.hidden = hidden;
        this.offset = offset;
        this.length = length;
    }
}

export class CompositeNode extends AbstractNode implements ICompositeNode {
    getOffset(): number {
        if (this.children.length > 0) {
            return this.children[0].getOffset();
        } else {
            return 0;
        }
    }
    getLength(): number {
        if (this.children.length > 0) {
            const last = this.children[this.children.length - 1];
            return last.getOffset() + last.getLength();
        } else {
            return 0;
        }
    }
    children: INode[] = [];
}

export class RootNode extends CompositeNode {

    private text = "";

    setText(text: string): void {
        this.text = text;
    }

    getText(): string {
        return this.text;
    }

    getOffset(): number {
        return 0;
    }

    getLength(): number {
        return this.text.length;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuleResult<T> = (idxInCallingRule?: number, ...args: any[]) => PartialDeep<T>