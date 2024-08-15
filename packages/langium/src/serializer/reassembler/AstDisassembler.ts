/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Reference } from '../../syntax-tree.js';
import { isRootCstNode, type AstNode, type CstNode, type Mutable, isCompositeCstNode, isLeafCstNode, isAstNode, isReference } from '../../syntax-tree.js';
import { streamAst } from '../../utils/ast-utils.js';
import { streamCst } from '../../utils/cst-utils.js';
import { BiMap, type LangiumCoreServices, assertType, type ParseResult } from '../../index.js';
import { type AbstractElement } from '../../languages/generated/ast.js';
import type { AstAssemblerInstruction, Instructions, ReferenceData } from './AstAssemblerInstruction.js';
import { InstructionType, NodeType, ErrorSource } from './AstAssemblerInstruction.js';
import { createGrammarElementIdMap } from './AstAssemblerInstruction.js';

export interface AstDisassembler {
    disassemble(parseResult: ParseResult<AstNode>): Generator<AstAssemblerInstruction, void, void>;
}

export class DefaultAstDisassembler implements AstDisassembler {
    private readonly cstNodeToId = new Map<CstNode, number>();
    private readonly astNodeToId = new Map<AstNode, number>();
    private readonly grammarElementIdMap = new BiMap<AbstractElement, number>();

    constructor(services: LangiumCoreServices) {
        this.grammarElementIdMap = createGrammarElementIdMap(services.Grammar);
    }

    *disassemble(parseResult: ParseResult<AstNode>): Generator<AstAssemblerInstruction, void, void> {
        //allocate memory for all nodes
        const astNode = parseResult.value;
        const cstRoot = astNode.$cstNode!;
        this.enumerateNodes(astNode, astNode.$cstNode!);
        yield <Instructions.Allocate>{
            $type: InstructionType.Allocate,
            cstNodeCount: this.cstNodeToId.size,
            astNodeCount: this.astNodeToId.size
        };

        //send cst nodes
        let cstNodeStack: Array<Mutable<CstNode>> = [];
        for (const node of streamCst(cstRoot)) {
            assertType<Mutable<CstNode>>(node);
            if (isRootCstNode(node)) {
                yield <Instructions.RootCstNode>{
                    $type: InstructionType.RootCstNode,
                    input: node.fullText,
                    astNodeId: this.astNodeToId.get(node.astNode)
                };
                cstNodeStack = [node];
            } else if(isCompositeCstNode(node)) {
                while(cstNodeStack[cstNodeStack.length-1] !== node.container) {
                    cstNodeStack.pop();
                    yield <Instructions.PopCstNode>{
                        $type: InstructionType.PopCstNode
                    };
                }
                yield <Instructions.CompositeCstNode>{
                    $type: InstructionType.CompositeCstNode,
                    elementId: this.grammarElementIdMap.get(node.grammarSource)!,
                    astNodeId: this.astNodeToId.get(node.astNode)
                };
                cstNodeStack.push(node);
            } else if(isLeafCstNode(node)) {
                while(cstNodeStack[cstNodeStack.length-1] !== node.container) {
                    cstNodeStack.pop();
                    yield <Instructions.PopCstNode>{
                        $type: InstructionType.PopCstNode
                    };
                }
                yield <Instructions.LeafCstNode>{
                    $type: InstructionType.LeafCstNode,
                    elementId: this.grammarElementIdMap.get(node.grammarSource)!,
                    hidden: node.hidden,
                    range: node.range,
                    tokenTypeName: node.tokenType.name,
                    tokenOffset: node.offset,
                    tokenLength: node.length,
                    astNodeId: this.astNodeToId.get(node.astNode)
                };
            }
        }

        //send ast nodes
        for (const node of streamAst(astNode)) {
            assertType<Mutable<AstNode>>(node);
            const sourceId = this.astNodeToId.get(node)!;

            const setProperty = (property: string, value: number | boolean | string | bigint) => (<Instructions.Property>{
                $type: InstructionType.Property,
                sourceId,
                property,
                value
            });

            const setPropertyArray = (property: string, values: Array<number | boolean | string | bigint>) => (<Instructions.PropertyArray>{
                $type: InstructionType.PropertyArray,
                sourceId,
                property,
                values
            });

            const setLink = (property: string, type: NodeType, index: number) => (<Instructions.LinkNode>{
                $type: InstructionType.LinkNode,
                sourceId,
                targetKind: type,
                targetId: index,
                property,
            });

            const setLinkArray = (property: string, type: NodeType, indices: number[]) => (<Instructions.LinkNodeArray>{
                $type: InstructionType.LinkNodeArray,
                sourceId,
                targetKind: type,
                targetIds: indices,
                property,
            });

            const setReferenceArray = (property: string, references: ReferenceData[]) => (<Instructions.ReferenceArray>{
                $type: InstructionType.ReferenceArray,
                sourceId,
                property,
                references
            });

            const setReference = (property: string, reference: ReferenceData) => (<Instructions.Reference>{
                $type: InstructionType.Reference,
                sourceId,
                property,
                ...reference
            });

            const setEmpty = (property: string) => (<Instructions.Empty>{
                $type: InstructionType.Empty,
                sourceId,
                property,
            });

            yield setProperty('$type', node.$type);
            if (node.$containerIndex) {
                yield setProperty('$containerIndex', node.$containerIndex);
            }
            if (node.$containerProperty) {
                yield setProperty('$containerProperty', node.$containerProperty);
            }
            if (node.$container) {
                yield setLink('$container', NodeType.Ast, this.astNodeToId.get(node.$container)!);
            }
            if (node.$cstNode !== undefined) {
                yield setLink('$cstNode', NodeType.Cst, this.cstNodeToId.get(node.$cstNode)!);
            }
            for (const [name, value] of Object.entries(node)) {
                if (name.startsWith('$')) {
                    continue;
                }
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        const item = value[0];
                        if (isAstNode(item)) {
                            assertType<AstNode[]>(value);
                            yield setLinkArray(name, NodeType.Ast, value.map(v => this.astNodeToId.get(v)!));
                        } else if (isReference(item)) {
                            assertType<Reference[]>(value);
                            yield setReferenceArray(name, value.map(v => (<ReferenceData>{
                                refText: v.$refText,
                                refNode: v.$refNode ? this.cstNodeToId.get(v.$refNode) : undefined
                            })));
                        } else {
                            //type string[]: just to keep Typescript calm
                            yield setPropertyArray(name, value as string[]);
                        }
                    } else {
                        yield setEmpty(name);
                    }
                } else if (isAstNode(value)) {
                    yield setLink(name, NodeType.Ast, this.astNodeToId.get(value)!);
                } else if (isReference(value)) {
                    yield setReference(name, <ReferenceData>{
                        refText: value.$refText,
                        refNode: value.$refNode ? this.cstNodeToId.get(value.$refNode) : undefined
                    });
                } else if (typeof value === 'boolean' || typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string') {
                    yield setProperty(name, value);
                }
            }
        }

        //send errors
        for (const error of parseResult.lexerErrors) {
            yield <Instructions.Error>{
                $type: InstructionType.Error,
                source: ErrorSource.Lexer,
                items: { ...error, message: error.message }
            };
        }
        for (const error of parseResult.parserErrors) {
            yield <Instructions.Error>{
                $type: InstructionType.Error,
                source: ErrorSource.Parser,
                items: { ...error, message: error.message }
            };
        }

        //mark end with root node
        yield <Instructions.Return>{
            $type: InstructionType.Return,
            rootAstNodeId: this.astNodeToId.get(astNode)!
        };
    }

    private enumerateNodes(astRoot: AstNode, cstRoot: CstNode): void {
        this.cstNodeToId.clear();
        [...streamCst(cstRoot)].forEach((cstNode, index) => {
            this.cstNodeToId.set(cstNode, index);
        });
        this.astNodeToId.clear();
        [...streamAst(astRoot)].forEach((astNode, index) => {
            this.astNodeToId.set(astNode, index);
        });
    }
}
