/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TokenType } from 'chevrotain';
import { CompositeCstNodeImpl, LeafCstNodeImpl, RootCstNodeImpl } from '../parser/cst-node-builder.js';
import { isAbstractElement, type AbstractElement, type Grammar } from '../languages/generated/ast.js';
import type { Linker } from '../references/linker.js';
import type { Lexer } from '../parser/lexer.js';
import type { LangiumCoreServices } from '../services.js';
import type { Reference, AstNode, CstNode, LeafCstNode, GenericAstNode, Mutable } from '../syntax-tree.js';
import { isRootCstNode, isCompositeCstNode, isLeafCstNode, isAstNode, isReference } from '../syntax-tree.js';
import { streamAst } from '../utils/ast-utils.js';
import { BiMap } from '../utils/collections.js';
import { streamCst } from '../utils/cst-utils.js';

/**
 * The hydrator service is responsible for allowing AST nodes to be sent across worker threads.
 */
export interface Hydrator {
    /**
     * Converts an AST node to a plain object. The resulting object can be sent across worker threads.
     */
    dehydrate(node: AstNode): object;
    /**
     * Converts a plain object to an AST node. The resulting AST node can be used in the main thread.
     * Calling this method on non-plain objects will result in undefined behavior.
     */
    hydrate(node: object): AstNode;
}

export interface DehydrateContext {
    astNodes: Map<AstNode, any>;
    cstNodes: Map<CstNode, any>;
}

export interface HydrateContext {
    astNodes: Map<any, AstNode>;
    cstNodes: Map<any, CstNode>;
}

export class DefaultHydrator implements Hydrator {

    protected readonly grammar: Grammar;
    protected readonly lexer: Lexer;
    protected readonly linker: Linker;

    protected readonly grammarElementIdMap = new BiMap<AbstractElement, number>();
    protected readonly tokenTypeIdMap = new BiMap<number, TokenType>();

    constructor(services: LangiumCoreServices) {
        this.grammar = services.Grammar;
        this.lexer = services.parser.Lexer;
        this.linker = services.references.Linker;
    }

    dehydrate(node: AstNode): object {
        return this.dehydrateAstNode(node, this.createDehyrationContext(node));
    }

    protected createDehyrationContext(node: AstNode): DehydrateContext {
        const astNodes = new Map<AstNode, any>();
        const cstNodes = new Map<CstNode, any>();
        for (const astNode of streamAst(node)) {
            astNodes.set(astNode, {});
        }
        if (node.$cstNode) {
            for (const cstNode of streamCst(node.$cstNode)) {
                cstNodes.set(cstNode, {});
            }
        }
        return {
            astNodes,
            cstNodes
        };
    }

    protected dehydrateAstNode(node: AstNode, context: DehydrateContext): object {
        const obj = context.astNodes.get(node) as Record<string, any>;
        obj.$type = node.$type;
        obj.$containerIndex = node.$containerIndex;
        obj.$containerProperty = node.$containerProperty;
        if (node.$cstNode !== undefined) {
            obj.$cstNode = this.dehydrateCstNode(node.$cstNode, context);
        }
        for (const [name, value] of Object.entries(node)) {
            if (name.startsWith('$')) {
                continue;
            }
            if (Array.isArray(value)) {
                const arr: any[] = [];
                obj[name] = arr;
                for (const item of value) {
                    if (isAstNode(item)) {
                        arr.push(this.dehydrateAstNode(item, context));
                    } else if (isReference(item)) {
                        arr.push(this.dehydrateReference(item, context));
                    } else {
                        arr.push(item);
                    }
                }
            } else if (isAstNode(value)) {
                obj[name] = this.dehydrateAstNode(value, context);
            } else if (isReference(value)) {
                obj[name] = this.dehydrateReference(value, context);
            } else if (value !== undefined) {
                obj[name] = value;
            }
        }
        return obj;
    }

    protected dehydrateReference(reference: Reference, context: DehydrateContext): any {
        const obj: Record<string, unknown> = {};
        obj.$refText = reference.$refText;
        if (reference.$refNode) {
            obj.$refNode = context.cstNodes.get(reference.$refNode);
        }
        return obj;
    }

    protected dehydrateCstNode(node: CstNode, context: DehydrateContext): any {
        const cstNode = context.cstNodes.get(node) as Record<string, any>;
        if (isRootCstNode(node)) {
            cstNode.fullText = node.fullText;
        } else {
            cstNode.grammarSource = this.getGrammarElementId(node.grammarSource);
        }
        cstNode.hidden = node.hidden;
        cstNode.astNode = context.astNodes.get(node.astNode);
        if (isCompositeCstNode(node)) {
            cstNode.content = node.content.map(child => this.dehydrateCstNode(child, context));
        } else if (isLeafCstNode(node)) {
            cstNode.tokenType = node.tokenType.name;
            cstNode.offset = node.offset;
            cstNode.length = node.length;
            cstNode.startLine = node.range.start.line;
            cstNode.startColumn = node.range.start.character;
            cstNode.endLine = node.range.end.line;
            cstNode.endColumn = node.range.end.character;
        }
        return cstNode;
    }

    hydrate(node: object): AstNode {
        const context = this.createHydrationContext(node);
        if ('$cstNode' in node) {
            this.hydrateCstNode(node.$cstNode, context);
        }
        return this.hydrateAstNode(node, context);
    }

    protected createHydrationContext(node: any): HydrateContext {
        const astNodes = new Map<any, AstNode>();
        const cstNodes = new Map<any, CstNode>();
        for (const astNode of streamAst(node)) {
            astNodes.set(astNode, {} as AstNode);
        }
        if (node.$cstNode) {
            for (const cstNode of streamCst(node.$cstNode)) {
                let cst: CstNode | undefined;
                if ('fullText' in cstNode) {
                    cst = new RootCstNodeImpl(cstNode.fullText as string);
                } else if ('content' in cstNode) {
                    cst = new CompositeCstNodeImpl();
                } else if ('tokenType' in cstNode) {
                    cst = this.hydrateCstLeafNode(cstNode);
                }
                if (cst) {
                    cstNodes.set(cstNode, cst);
                }
            }
        }
        return {
            astNodes,
            cstNodes
        };
    }

    protected hydrateAstNode(node: any, context: HydrateContext): AstNode {
        const astNode = context.astNodes.get(node) as Mutable<GenericAstNode>;
        astNode.$type = node.$type;
        astNode.$containerIndex = node.$containerIndex;
        astNode.$containerProperty = node.$containerProperty;
        if (node.$cstNode) {
            astNode.$cstNode = context.cstNodes.get(node.$cstNode);
        }
        for (const [name, value] of Object.entries(node)) {
            if (name.startsWith('$')) {
                continue;
            }
            if (Array.isArray(value)) {
                const arr: unknown[] = [];
                astNode[name] = arr;
                for (const item of value) {
                    if (isAstNode(item)) {
                        arr.push(this.setParent(this.hydrate(item), astNode));
                    } else if (isReference(item)) {
                        arr.push(this.hydrateReference(item, astNode, name, context));
                    } else {
                        arr.push(item);
                    }
                }
            } else if (isAstNode(value)) {
                astNode[name] = this.setParent(this.hydrate(value), astNode);
            } else if (isReference(value)) {
                astNode[name] = this.hydrateReference(value, astNode, name, context);
            } else if (value !== undefined) {
                astNode[name] = value;
            }
        }
        return astNode;
    }

    protected setParent(node: any, parent: any): any {
        node.$container = parent as AstNode;
        return node;
    }

    protected hydrateReference(reference: any, node: AstNode, name: string, context: HydrateContext): Reference {
        return this.linker.buildReference(node, name, context.cstNodes.get(reference.$refNode)!, reference.$refText);
    }

    protected hydrateCstNode(cstNode: any, context: HydrateContext, num = 0): CstNode {
        const cstNodeObj = context.cstNodes.get(cstNode) as Mutable<CstNode>;
        if (typeof cstNode.grammarSource === 'number') {
            cstNodeObj.grammarSource = this.getGrammarElement(cstNode.grammarSource);
        }
        cstNodeObj.astNode = context.astNodes.get(cstNode.astNode)!;
        if (isCompositeCstNode(cstNodeObj)) {
            for (const child of cstNode.content) {
                const hydrated = this.hydrateCstNode(child, context, num++);
                cstNodeObj.content.push(hydrated);
            }
        }
        return cstNodeObj;
    }

    protected hydrateCstLeafNode(cstNode: any): LeafCstNode {
        const tokenType = this.getTokenType(cstNode.tokenType);
        const offset = cstNode.offset;
        const length = cstNode.length;
        const startLine = cstNode.startLine;
        const startColumn = cstNode.startColumn;
        const endLine = cstNode.endLine;
        const endColumn = cstNode.endColumn;
        const hidden = cstNode.hidden;
        const node = new LeafCstNodeImpl(
            offset,
            length,
            {
                start: {
                    line: startLine,
                    character: startColumn
                },
                end: {
                    line: endLine,
                    character: endColumn
                }
            },
            tokenType,
            hidden
        );
        return node;
    }

    protected getTokenType(name: string): TokenType {
        return this.lexer.definition[name];
    }

    protected getGrammarElementId(node: AbstractElement): number {
        if (this.grammarElementIdMap.size === 0) {
            this.createGrammarElementIdMap();
        }
        return this.grammarElementIdMap.get(node) ?? -1;
    }

    protected getGrammarElement(id: number): AbstractElement {
        if (this.grammarElementIdMap.size === 0) {
            this.createGrammarElementIdMap();
        }
        const element = this.grammarElementIdMap.getKey(id);
        if (element) {
            return element;
        } else {
            throw new Error('Invalid grammar element id: ' + id);
        }
    }

    protected createGrammarElementIdMap(): void {
        let id = 0;
        for (const element of streamAst(this.grammar)) {
            if (isAbstractElement(element)) {
                this.grammarElementIdMap.set(element, id++);
            }
        }
    }

}
