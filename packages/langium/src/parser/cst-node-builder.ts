/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken, TokenType } from 'chevrotain';
import { AbstractElement } from '../grammar/generated/ast';
import { AstNode, CompositeCstNode, CstNode, CstRange, LeafCstNode } from '../syntax-tree';

export class CstNodeBuilder {

    private rootNode!: RootCstNodeImpl;
    private nodeStack: CompositeCstNodeImpl[] = [];

    private get current(): CompositeCstNodeImpl {
        return this.nodeStack[this.nodeStack.length - 1];
    }

    buildRootNode(input: string): void {
        this.rootNode = new RootCstNodeImpl(input);
        this.nodeStack = [this.rootNode];
    }

    buildCompositeNode(feature: AbstractElement): CompositeCstNode {
        const compositeNode = new CompositeCstNodeImpl();
        compositeNode.feature = feature;
        compositeNode.root = this.rootNode;
        this.current.children.push(compositeNode);
        this.nodeStack.push(compositeNode);
        return compositeNode;
    }

    buildLeafNode(token: IToken, feature: AbstractElement): LeafCstNode {
        const leafNode = new LeafCstNodeImpl(token.startOffset, token.image.length, token.tokenType, false);
        leafNode.feature = feature;
        leafNode.root = this.rootNode;
        this.current.children.push(leafNode);
        return leafNode;
    }

    construct(item: { $cstNode: CstNode }): void {
        this.current.element = <AstNode>item;
        item.$cstNode = this.reduce(this.current);
        this.nodeStack.pop();
    }

    private reduce(node: CstNode): CstNode {
        if (node instanceof CompositeCstNodeImpl && node.children.length === 1 && node.children[0].element === node.element) {
            return this.reduce(node.children[0]);
        } else {
            return node;
        }
    }
}

export abstract class AbstractCstNode implements CstNode {
    abstract get offset(): number;
    abstract get length(): number;
    parent?: CompositeCstNode;
    feature!: AbstractElement;
    root!: RootCstNodeImpl;
    private _element!: AstNode;

    get element(): AstNode {
        return this._element ?? this.parent?.element;
    }

    set element(value: AstNode) {
        this._element = value;
    }

    get text(): string {
        const { start, end } = this.range;
        return this.root.text.substring(start, end);
    }

    get range(): CstRange {
        const offset = this.offset;
        return { start: offset, end: offset + this.length };
    }
}

export class LeafCstNodeImpl extends AbstractCstNode implements LeafCstNode {
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

    private _hidden: boolean;
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

export class CompositeCstNodeImpl extends AbstractCstNode implements CompositeCstNode {
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
            return Math.max(last.offset + last.length - this.offset, 0);
        } else {
            return 0;
        }
    }

    get range(): CstRange {
        if (this.children.length > 0) {
            const first = this.children[0];
            const last = this.children[this.children.length - 1];
            return { start: first.offset, end: Math.max(last.range.end, first.offset) };
        } else {
            return { start: 0, end: 0 };
        }
    }

    readonly children: CstNode[] = new CstNodeContainer(this);
}

class CstNodeContainer extends Array<CstNode> {
    readonly parent: CompositeCstNode;

    constructor(parent: CompositeCstNode) {
        super();
        this.parent = parent;
        Object.setPrototypeOf(this, CstNodeContainer.prototype);
    }

    push(...items: CstNode[]): number {
        this.addParents(items);
        return super.push(...items);
    }

    unshift(...items: CstNode[]): number {
        this.addParents(items);
        return super.unshift(...items);
    }

    splice(start: number, count: number, ...items: CstNode[]): CstNode[] {
        this.addParents(items);
        return super.splice(start, count, ...items);
    }

    private addParents(items: CstNode[]): void {
        for (const item of items) {
            (<AbstractCstNode>item).parent = this.parent;
        }
    }
}

export class RootCstNodeImpl extends CompositeCstNodeImpl {
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
