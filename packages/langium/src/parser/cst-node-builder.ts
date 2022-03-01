/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IToken, TokenType } from 'chevrotain';
import { Position, Range } from 'vscode-languageserver-types';
import { AbstractElement } from '../grammar/generated/ast';
import { AstNode, CompositeCstNode, CstNode, LeafCstNode } from '../syntax-tree';
import { tokenToRange } from '../utils/cst-util';

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
        const leafNode = new LeafCstNodeImpl(token.startOffset, token.image.length, tokenToRange(token), token.tokenType, false);
        leafNode.feature = feature;
        leafNode.root = this.rootNode;
        this.current.children.push(leafNode);
        return leafNode;
    }

    removeNode(node: CstNode): void {
        const parent = node.parent;
        if (parent) {
            const index = parent.children.indexOf(node);
            if (index >= 0) {
                parent.children.splice(index, 1);
            }
        }
    }

    construct(item: { $type: string | symbol | undefined, $cstNode: CstNode }): void {
        const current: CstNode = this.current;
        // The specified item could be a datatype ($type is symbol) or a fragment ($type is undefined)
        // Only if the $type is a string, we actually assign the element
        if (typeof item.$type === 'string') {
            this.current.element = <AstNode>item;
        }
        item.$cstNode = current;
        const node = this.nodeStack.pop();
        // Empty composite nodes are not valid
        // Simply remove the node from the tree
        if (node?.children.length === 0) {
            this.removeNode(node);
        }
    }
}

export abstract class AbstractCstNode implements CstNode {
    abstract get offset(): number;
    abstract get length(): number;
    abstract get end(): number;
    abstract get range(): Range;
    parent?: CompositeCstNode;
    feature!: AbstractElement;
    root!: RootCstNodeImpl;
    private _element!: AstNode;

    get hidden(): boolean {
        return false;
    }

    get element(): AstNode {
        return this._element ?? this.parent?.element;
    }

    set element(value: AstNode) {
        this._element = value;
    }

    get text(): string {
        return this.root.text.substring(this.offset, this.end);
    }
}

export class LeafCstNodeImpl extends AbstractCstNode implements LeafCstNode {
    get offset(): number {
        return this._offset;
    }

    get length(): number {
        return this._length;
    }

    get end(): number {
        return this._offset + this._length;
    }

    get hidden(): boolean {
        return this._hidden;
    }

    get tokenType(): TokenType {
        return this._tokenType;
    }

    get range(): Range {
        return this._range;
    }

    private _hidden: boolean;
    private _offset: number;
    private _length: number;
    private _range: Range;
    private _tokenType: TokenType;

    constructor(offset: number, length: number, range: Range, tokenType: TokenType, hidden = false) {
        super();
        this._hidden = hidden;
        this._offset = offset;
        this._tokenType = tokenType;
        this._length = length;
        this._range = range;
    }
}

export class CompositeCstNodeImpl extends AbstractCstNode implements CompositeCstNode {
    get offset(): number {
        if (this.children.length > 0) {
            return this.firstNonHiddenNode.offset;
        } else {
            return 0;
        }
    }

    get length(): number {
        return this.end - this.offset;
    }

    get end(): number {
        if (this.children.length > 0) {
            return this.lastNonHiddenNode.end;
        } else {
            return 0;
        }
    }

    get range(): Range {
        if (this.children.length > 0) {
            const { range: firstRange } = this.firstNonHiddenNode;
            const { range: lastRange } = this.lastNonHiddenNode;
            return { start: firstRange.start, end: lastRange.end.line < firstRange.start.line ? firstRange.start : lastRange.end };
        } else {
            return { start: Position.create(0, 0), end: Position.create(0, 0) };
        }
    }

    private get firstNonHiddenNode(): CstNode {
        for (const child of this.children) {
            if (!child.hidden) {
                return child;
            }
        }
        throw new Error('Composite node contains only hidden nodes');
    }

    private get lastNonHiddenNode(): CstNode {
        for (let i = this.children.length - 1; i >= 0; i--) {
            const child = this.children[i];
            if (!child.hidden) {
                return child;
            }
        }
        throw new Error('Composite node contains only hidden nodes');
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
