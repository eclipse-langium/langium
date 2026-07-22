/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { IToken, TokenType } from 'chevrotain';
import type { Range } from 'vscode-languageserver-types';
import type { AbstractElement } from '../languages/generated/ast.js';
import type { AstNode, CompositeCstNode, CstNode, LeafCstNode, RootCstNode } from '../syntax-tree.js';
import { Position } from 'vscode-languageserver-types';

/**
 * Incrementally builds the concrete syntax tree (CST) while the parser processes the input.
 *
 * The parser drives the builder with the following protocol: `buildRootNode` starts a new tree,
 * `buildCompositeNode` opens a nested node whenever a parser rule is invoked, `buildLeafNode`
 * adds a node for every consumed token, and `construct` closes the innermost open composite node
 * once its rule implementation has finished. Hidden tokens (e.g. comments and whitespace) are not
 * part of the parser's token stream and are added separately via `addHiddenNodes`.
 */
export class CstNodeBuilder {

    private rootNode!: RootCstNodeImpl;
    private nodeStack: CompositeCstNodeImpl[] = [];

    /**
     * The composite node currently being built, i.e. the one to which new child nodes are added:
     * the innermost parser rule invocation that has not been completed with `construct` yet.
     */
    get current(): CompositeCstNodeImpl {
        return this.nodeStack[this.nodeStack.length - 1] ?? this.rootNode;
    }

    /**
     * Reset the builder and create the root node of a new tree. This must be called once
     * before each parser run; all nodes built afterwards belong to the returned root.
     */
    buildRootNode(input: string): RootCstNode {
        this.rootNode = new RootCstNodeImpl(input);
        this.nodeStack = [this.rootNode];
        return this.rootNode;
    }

    /**
     * Create a composite node as a child of the current node and make it the new current node.
     * The parser calls this when a rule is invoked that creates its own AST node; the node
     * remains current until the corresponding `construct` call closes it.
     */
    buildCompositeNode(feature: AbstractElement): CompositeCstNode {
        const compositeNode = new CompositeCstNodeImpl();
        compositeNode.grammarSource = feature;
        this.appendChild(this.current, compositeNode);
        this.nodeStack.push(compositeNode);
        return compositeNode;
    }

    /**
     * Create a leaf node for a consumed token and append it to the current composite node.
     * If no grammar element is given, the token is treated as hidden (e.g. a comment).
     */
    buildLeafNode(token: IToken, feature?: AbstractElement): LeafCstNode {
        const leafNode = this.createLeafNode(token, !feature);
        if (feature) {
            leafNode.grammarSource = feature;
        }
        this.appendChild(this.current, leafNode);
        return leafNode;
    }

    /**
     * Create a detached leaf node from a token, translating Chevrotain's position
     * information to the LSP conventions used by the CST.
     */
    protected createLeafNode(token: IToken, hidden: boolean): LeafCstNodeImpl {
        // Chevrotain uses 1-based line/column indices, so we subtract 1 to align with the LSP.
        // The end column needs no adjustment: Chevrotain's inclusive end is the LSP's exclusive end.
        return new LeafCstNodeImpl(
            token.startOffset,
            token.image.length,
            token.startLine! - 1,
            token.startColumn! - 1,
            token.endLine! - 1,
            token.endColumn!,
            token.tokenType,
            hidden
        );
    }

    /**
     * Append a child node to the content of a composite node and set the child's container reference.
     */
    appendChild(parent: CompositeCstNode, child: CstNode): void {
        (child as AbstractCstNode).container = parent;
        (parent as CompositeCstNodeImpl).content.push(child);
    }

    /**
     * Append multiple child nodes to the content of a composite node and set their container references.
     */
    appendChildren(parent: CompositeCstNode, children: CstNode[]): void {
        for (const child of children) {
            (child as AbstractCstNode).container = parent;
        }
        if (parent.content.length === 0) {
            // Copying into a fresh array yields a backing store with exact capacity,
            // whereas pushing into an empty array over-allocates (see `construct`).
            (parent as CompositeCstNodeImpl).content = children.slice();
        } else {
            (parent.content as CstNode[]).push(...children);
        }
    }

    /**
     * Insert child nodes at the given index into the content of a composite node and set their container references.
     */
    insertChildren(parent: CompositeCstNode, index: number, children: CstNode[]): void {
        for (const child of children) {
            (child as AbstractCstNode).container = parent;
        }
        (parent as CompositeCstNodeImpl).content.splice(index, 0, ...children);
    }

    /**
     * Remove a node from the content of its container.
     */
    removeNode(node: CstNode): void {
        const parent = node.container;
        if (parent) {
            const index = parent.content.indexOf(node);
            if (index >= 0) {
                (parent as CompositeCstNodeImpl).content.splice(index, 1);
            }
        }
    }

    /**
     * Insert leaf nodes for hidden tokens (e.g. comments) into the tree. Since hidden tokens are
     * not part of the parser's token stream, the parser calls this separately: once before each
     * consumed token with the hidden tokens preceding it, and once after parsing for the trailing
     * hidden tokens. The nodes are attached where the tree is currently being built, so hidden
     * nodes end up next to the non-hidden token that follows them.
     */
    addHiddenNodes(tokens: IToken[]): void {
        const nodes: LeafCstNode[] = [];
        for (const token of tokens) {
            nodes.push(this.createLeafNode(token, true));
        }
        let current: CompositeCstNode = this.current;
        let added = false;
        // If we are within a composite node, we add the hidden nodes to the content
        if (current.content.length > 0) {
            this.appendChildren(current, nodes);
            return;
        }
        // Otherwise we are at a newly created node
        // Instead of adding the hidden nodes here, we search for the first parent node with content
        while (current.container) {
            const index = current.container.content.indexOf(current);
            if (index > 0) {
                // Add the hidden nodes before the current node
                this.insertChildren(current.container, index, nodes);
                added = true;
                break;
            }
            current = current.container;
        }
        // If we arrive at the root node, we add the hidden nodes at the beginning
        // This is the case if the hidden nodes are the first nodes in the tree
        if (!added) {
            this.insertChildren(this.rootNode, 0, nodes);
        }
    }

    /**
     * Close the current composite node and assign it to the given AST node (`item.$cstNode`).
     * The parser calls this when a rule implementation has finished, matching the preceding
     * `buildCompositeNode` (or `buildRootNode`) call; the parent node becomes current again.
     * If the closed node has no content, e.g. due to an unsuccessful optional rule call,
     * it is removed from the tree.
     */
    construct(item: { $type: string | symbol | undefined, $cstNode: CstNode, $infixName?: string }): void {
        const current: CstNode = this.current;
        item.$cstNode = current;
        const node = this.nodeStack.pop();
        if (node) {
            if (node.content.length === 0) {
                // Empty composite nodes are not valid
                // Simply remove the node from the tree
                this.removeNode(node);
            } else {
                // Compact the content array: pushing into an empty array makes V8 allocate a
                // backing store with capacity 16, wasting memory for the many small composite
                // nodes in typical CSTs. Copying yields a backing store with exact capacity.
                node.content = node.content.slice();
            }
        }
    }
}

export abstract class AbstractCstNode implements CstNode {
    abstract get offset(): number;
    abstract get length(): number;
    abstract get end(): number;
    abstract get range(): Range;
    abstract get astNode(): AstNode;
    abstract get hidden(): boolean;

    container: CompositeCstNode | undefined = undefined;
    grammarSource: AbstractElement | undefined = undefined;

    get root(): RootCstNode {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let node: CstNode = this;
        while (node.container) {
            node = node.container;
        }
        return node as RootCstNode;
    }

    get text(): string {
        return this.root.fullText.substring(this.offset, this.end);
    }
}

export class LeafCstNodeImpl extends AbstractCstNode implements LeafCstNode {
    private _hidden: boolean;
    private _offset: number;
    private _length: number;
    private _startLine: number;
    private _startColumn: number;
    private _endLine: number;
    private _endColumn: number;
    private _tokenType: TokenType;

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

    get astNode(): AstNode {
        const container = this.container;
        if (!container) {
            throw new Error('This node has no associated AST element');
        }
        return container.astNode;
    }

    get range(): Range {
        return {
            start: {
                line: this._startLine,
                character: this._startColumn
            },
            end: {
                line: this._endLine,
                character: this._endColumn
            }
        };
    }

    /**
     * All position values are 0-based and the end position is exclusive,
     * following the LSP convention (see the `Range` type).
     */
    constructor(offset: number, length: number, startLine: number, startColumn: number,
        endLine: number, endColumn: number, tokenType: TokenType, hidden = false) {
        super();
        this._hidden = hidden;
        this._offset = toSmi(offset);
        this._length = toSmi(length);
        this._startLine = toSmi(startLine);
        this._startColumn = toSmi(startColumn);
        this._endLine = toSmi(endLine);
        this._endColumn = toSmi(endColumn);
        this._tokenType = tokenType;
    }
}

/**
 * Normalizes a number so V8 stores it as an inline small integer (Smi field representation).
 * Without this, the CST node fields inherit the boxed heap number ("double") representation
 * of Chevrotain's token position fields, costing 16 extra bytes per number. The conversion
 * is lossless here because offsets and positions are always non-negative integers far below 2^31.
 */
function toSmi(value: number): number {
    // eslint-disable-next-line no-bitwise
    return value | 0;
}

export class CompositeCstNodeImpl extends AbstractCstNode implements CompositeCstNode {
    /**
     * This array must not be modified directly; use the `CstNodeBuilder` methods instead
     * to ensure that the `container` references of the child nodes are set correctly.
     */
    content: CstNode[] = [];
    /**
     * These fields are assigned lazily, but eagerly initialized with `undefined` so V8 reserves
     * in-object slots for them. Without the initializers, late assignments would go to an
     * out-of-object backing store, costing more memory than the reserved slots and splitting
     * the hidden class of composite nodes (slower property access).
     */
    private _astNode: AstNode | undefined = undefined;
    private _rangeCache: Range | undefined = undefined;

    get astNode(): AstNode {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let node: CompositeCstNodeImpl | undefined = this;
        while (node) {
            if (node._astNode) {
                return node._astNode;
            }
            node = node.container as CompositeCstNodeImpl | undefined;
        }
        throw new Error('This node has no associated AST element');
    }

    set astNode(value: AstNode | undefined) {
        this._astNode = value;
    }

    get hidden(): boolean {
        return false;
    }

    get offset(): number {
        return this.firstNonHiddenNode?.offset ?? 0;
    }

    get length(): number {
        return this.end - this.offset;
    }

    get end(): number {
        return this.lastNonHiddenNode?.end ?? 0;
    }

    get range(): Range {
        const firstNode = this.firstNonHiddenNode;
        const lastNode = this.lastNonHiddenNode;
        if (firstNode && lastNode) {
            if (this._rangeCache === undefined) {
                const { range: firstRange } = firstNode;
                const { range: lastRange } = lastNode;
                this._rangeCache = { start: firstRange.start, end: lastRange.end.line < firstRange.start.line ? firstRange.start : lastRange.end };
            }
            return this._rangeCache;
        } else {
            return { start: Position.create(0, 0), end: Position.create(0, 0) };
        }
    }

    private get firstNonHiddenNode(): CstNode | undefined {
        for (const child of this.content) {
            if (!child.hidden) {
                return child;
            }
        }
        return this.content[0];
    }

    private get lastNonHiddenNode(): CstNode | undefined {
        for (let i = this.content.length - 1; i >= 0; i--) {
            const child = this.content[i];
            if (!child.hidden) {
                return child;
            }
        }
        return this.content[this.content.length - 1];
    }
}

export class RootCstNodeImpl extends CompositeCstNodeImpl implements RootCstNode {
    private _text = '';

    override get text(): string {
        return this._text.substring(this.offset, this.end);
    }

    get fullText(): string {
        return this._text;
    }

    constructor(input?: string) {
        super();
        this._text = input ?? '';
    }
}
