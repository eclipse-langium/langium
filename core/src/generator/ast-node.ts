/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { TokenType } from 'chevrotain';
import { AbstractElement } from '../gen/ast';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AstNode {

    export const kind: Kind = { value: 'AstNode', super: [] };

    export const cstNode = Symbol('node');

    export function is<T extends AstNode>(item: AstNode, ...kinds: Kind[]): item is T {
        return !!item && 'kind' in item && typeof item.kind === 'object' && Kind.instanceOf(item.kind, ...kinds);
    }

    export function getContainer(item: AstNode, ...kinds: Kind[]): AstNode | undefined {
        if (!!item && item.container) {
            if (is(item.container, ...kinds)) {
                return item.container;
            } else {
                return getContainer(item.container, ...kinds);
            }
        } else {
            return undefined;
        }
    }
}

export type Kind = {
    value: string,
    super: Kind[]
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Kind {
    function instanceOfSingle(itemKind: Kind, target: Kind): boolean {
        return itemKind.value === target.value || itemKind.super.some(e => instanceOfSingle(e, target));
    }
    export function instanceOf(itemKind: Kind, ...targets: Kind[]): boolean {
        return targets.some(e => instanceOfSingle(itemKind, e));
    }
}

export interface AstNode {
    readonly kind: Kind,
    readonly container?: AstNode,
    readonly [AstNode.cstNode]?: CstNode
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace String {
    export const kind: Kind = { value: 'String', super: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(item: any): boolean {
        return AstNode.is(item, kind);
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Number {
    export const kind: Kind = { value: 'Number', super: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(item: any): boolean {
        return AstNode.is(item, kind);
    }
}

export interface Reference<T extends AstNode> {
    readonly value?: T;
    readonly uri: string;
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

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CstNode {

    export function flatten(node: CstNode): ILeafCstNode[] {
        if (node instanceof LeafCstNode) {
            return [node];
        } else if (node instanceof CompositeCstNode) {
            return node.children.flatMap(e => flatten(e));
        } else {
            return [];
        }
    }

}

export abstract class AbstractCstNode implements CstNode {
    abstract get offset(): number;
    abstract get length(): number;
    parent?: ICompositeCstNode;
    feature!: AbstractElement;
    root!: RootCstNode;
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
}

export interface ICompositeCstNode extends CstNode {
    children: CstNode[];
}

export interface ILeafCstNode extends CstNode {
    readonly hidden: boolean;
    readonly tokenType: TokenType;
}

export class LeafCstNode extends AbstractCstNode implements ILeafCstNode {
    get offset(): number {
        return this._offset;
    }
    get length(): number {
        return this._length;
    }
    get hidden(): boolean {
        return this._hidden;
    }
    get tokenType(): TokenType {
        return this._tokenType;
    }

    _hidden = false;

    private _offset: number;
    private _length: number;
    private _tokenType: TokenType;

    constructor(offset: number, length: number, tokenType: TokenType, hidden = false) {
        super();
        this._hidden = hidden;
        this._offset = offset;
        this._tokenType = tokenType;
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
        for (const item of items) {
            (<AbstractCstNode>item).parent = this.parent;
        }
        return super.push(...items);
    }
}

export class RootCstNode extends CompositeCstNode {

    private _text = '';

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

    constructor(input?: string) {
        super();
        this._text = input ?? '';
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuleResult = (idxInCallingRule?: number, ...args: any[]) => any
