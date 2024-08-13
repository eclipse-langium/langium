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
    private readonly deleteOriginal: boolean;

    constructor(services: LangiumCoreServices, deleteOriginal: boolean) {
        this.deleteOriginal = deleteOriginal;
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
        for (const node of streamCst(cstRoot)) {
            assertType<Mutable<CstNode>>(node);
            const sourceKind = NodeType.Cst;
            const sourceId = this.cstNodeToId.get(node)!;

            const setTokenType = (property: string, tokenName: string) => {
                const instr = <Instructions.TokenType>{
                    $type: InstructionType.TokenType,
                    sourceKind,
                    sourceId,
                    property,
                    tokenName
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            const setProperty = (property: string, value: number | boolean | string | bigint) => {
                const instr = <Instructions.Property>{
                    $type: InstructionType.Property,
                    sourceKind,
                    sourceId,
                    property,
                    value
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            const setLink = (property: string, type: NodeType, index: number) => {
                const instr = <Instructions.LinkNode>{
                    $type: InstructionType.LinkNode,
                    sourceKind,
                    sourceId,
                    targetKind: type,
                    targetId: index,
                    property,
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            const setLinks = (property: string, type: NodeType, indices: number[]) => {
                const instr = <Instructions.LinkNodes>{
                    $type: InstructionType.LinkNodes,
                    sourceKind,
                    sourceId,
                    targetKind: type,
                    targetIds: indices,
                    property,
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            const setElement = (property: string, value: number) => {
                const instr = <Instructions.Element>{
                    $type: InstructionType.Element,
                    sourceKind,
                    sourceId,
                    property,
                    value
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            if (isRootCstNode(node)) {
                yield setProperty('fullText', node.fullText);
            } else {
                // Note: This returns undefined for hidden nodes (i.e. comments)
                yield setElement('grammarSource', this.grammarElementIdMap.get(node.grammarSource)!);
            }
            yield setProperty('hidden', node.hidden);
            yield setLink('astNode', NodeType.Ast, this.astNodeToId.get(node.astNode)!);
            if (isCompositeCstNode(node)) {
                yield setLinks('content', NodeType.Cst, node.content.map(c => this.cstNodeToId.get(c)!));
            } else if (isLeafCstNode(node)) {
                yield setTokenType('tokenType', node.tokenType.name);
            }
            yield setProperty('offset', node.offset);
            yield setProperty('length', node.length);
            yield setLink('root', NodeType.Cst, this.cstNodeToId.get(node.root)!);
            if (node.container) {
                yield setLink('container', NodeType.Cst, this.cstNodeToId.get(node.container)!);
            }
            yield setProperty('startLine', node.range.start.line);
            yield setProperty('startColumn', node.range.start.character);
            yield setProperty('endLine', node.range.end.line);
            yield setProperty('endColumn', node.range.end.character);
        }

        //send ast nodes
        for (const node of streamAst(astNode)) {
            assertType<Mutable<AstNode>>(node);
            const sourceKind = NodeType.Ast;
            const sourceId = this.astNodeToId.get(node)!;

            const cleanUp = (property: string) => {
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
            };

            const setProperty = (property: string, value: number | boolean | string | bigint) => {
                const instr = <Instructions.Property>{
                    $type: InstructionType.Property,
                    sourceKind,
                    sourceId,
                    property,
                    value
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            const setProperties = (property: string, values: Array<number | boolean | string | bigint>) => {
                const instr = <Instructions.Properties>{
                    $type: InstructionType.Properties,
                    sourceKind,
                    sourceId,
                    property,
                    values
                };
                cleanUp(property);
                return instr;
            };

            const setLink = (property: string, type: NodeType, index: number) => {
                const instr = <Instructions.LinkNode>{
                    $type: InstructionType.LinkNode,
                    sourceKind,
                    sourceId,
                    targetKind: type,
                    targetId: index,
                    property,
                };
                if (this.deleteOriginal) {
                    assertType<Record<string, undefined>>(node);
                    node[property] = undefined!;
                }
                return instr;
            };

            const setLinks = (property: string, type: NodeType, indices: number[]) => {
                const instr = <Instructions.LinkNodes>{
                    $type: InstructionType.LinkNodes,
                    sourceKind,
                    sourceId,
                    targetKind: type,
                    targetIds: indices,
                    property,
                };
                cleanUp(property);
                return instr;
            };

            const setReferences = (property: string, references: ReferenceData[]) => {
                const instr = <Instructions.References>{
                    $type: InstructionType.References,
                    sourceKind,
                    sourceId,
                    property,
                    references
                };
                cleanUp(property);
                return instr;
            };

            const setReference = (property: string, reference: ReferenceData) => {
                const instr = <Instructions.Reference>{
                    $type: InstructionType.Reference,
                    sourceKind,
                    sourceId,
                    property,
                    ...reference
                };
                cleanUp(property);
                return instr;
            };

            const setEmpty = (property: string) => {
                const instr = <Instructions.Empty>{
                    $type: InstructionType.Empty,
                    sourceKind,
                    sourceId,
                    property,
                };
                cleanUp(property);
                return instr;
            };

            yield setProperty('$type', node.$type);
            if (node.$containerIndex) {
                yield setProperty('$containerIndex', node.$containerIndex);
            }
            if (node.$containerProperty) {
                yield setProperty('$containerProperty', node.$containerProperty);
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
                            yield setLinks(name, NodeType.Ast, value.map(v => this.astNodeToId.get(v)!));
                        } else if (isReference(item)) {
                            assertType<Reference[]>(value);
                            yield setReferences(name, value.map(v => (<ReferenceData>{
                                refText: v.$refText,
                                refNode: v.$refNode ? this.cstNodeToId.get(v.$refNode) : undefined
                            })));
                        } else {
                            //type string[]: just to keep Typescript calm
                            yield setProperties(name, value as string[]);
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
