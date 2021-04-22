import { PartialDeep } from "type-fest";
import { AbstractElement } from "../gen/ast";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AstNode {

    export const kind: Kind = { value: 'AstNode', super: [] };

    export const cstNode = Symbol("node");

    export function is<T extends AstNode>(item: AstNode, kind: Kind): item is T {
        return !!item && 'kind' in item && typeof item.kind === "object" && Kind.instanceOf(item.kind, kind);
    }
}

export type Kind = {
    value: string,
    super: Kind[]
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Kind {
    export function instanceOf(itemKind: Kind, target: Kind): boolean {
        return itemKind.value === target.value || itemKind.super.some(e => instanceOf(e, target));
    }
}

export interface AstNode {
    readonly kind: Kind,
    readonly container?: AstNode,
    readonly [AstNode.cstNode]?: CstNode
}

export interface CstNode {
    readonly parent?: ICompositeCstNode;
    readonly offset: number;
    readonly length: number;
    readonly text: string;
    readonly root: RootCstNode;
    readonly feature: AbstractElement;
    readonly element: AstNode;
}

export abstract class AbstractCstNode implements CstNode {
    abstract get offset(): number;
    abstract get length(): number;
    parent?: ICompositeCstNode;
    feature!: AbstractElement;
    private _element!: AstNode;

    get element(): AstNode {
        return this._element ?? this.parent?.element;
    }

    set element(value: AstNode) {
        this._element = value;
    }

    get text(): string {
        const offset = this.offset;
        return this.root.text.substring(offset, offset + this.length);
    }

    get root(): RootCstNode {
        const parent = this.parent;
        if (parent instanceof RootCstNode) {
            return parent;
        } else if (parent) {
            return parent.root;
        } else {
            throw new Error("Node has no root");
        }
    }
}

export interface ICompositeCstNode extends CstNode {
    children: CstNode[];
}

export interface ILeafCstNode extends CstNode {
    hidden: boolean;
}

export class LeafCstNode extends AbstractCstNode implements ILeafCstNode {
    get offset(): number {
        return this._offset;
    }
    get length(): number {
        return this._length;
    }
    hidden = false;

    private _offset: number;
    private _length: number;

    constructor(offset: number, length: number, hidden = false) {
        super();
        this.hidden = hidden;
        this._offset = offset;
        this._length = length;
    }
}

export class CompositeCstNode extends AbstractCstNode implements ICompositeCstNode {
    get offset(): number {
        if (this.children.length > 0) {
            return this.children[0].offset;
        } else {
            return 0;
        }
    }
    get length(): number {
        if (this.children.length > 0) {
            const last = this.children[this.children.length - 1];
            return last.offset + last.length - this.offset;
        } else {
            return 0;
        }
    }
    children: CstNode[] = new CstNodeContainer(this);
}

class CstNodeContainer extends Array<CstNode> {
    parent: ICompositeCstNode;

    constructor(parent: ICompositeCstNode) {
        super();
        this.parent = parent;
        Object.setPrototypeOf(this, CstNodeContainer.prototype);
    }

    push(...items: CstNode[]): number {
        items.forEach(e => {
            (<AbstractCstNode>e).parent = this.parent;
        })
        return super.push(...items);
    }
}

export class RootCstNode extends CompositeCstNode {

    private _text = "";

    set text(value: string) {
        this._text = value;
    }

    get text(): string {
        return this._text;
    }

    get offset(): number {
        return 0;
    }

    get length(): number {
        return this.text.length;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuleResult<T> = (idxInCallingRule?: number, ...args: any[]) => PartialDeep<T>