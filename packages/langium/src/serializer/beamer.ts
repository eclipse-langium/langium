/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Reference } from '../syntax-tree.js';
import { isRootCstNode, type AstNode, type CstNode, type Mutable, isCompositeCstNode, isLeafCstNode, isAstNode, isReference } from '../syntax-tree.js';
import { streamAst } from '../utils/ast-utils.js';
import { streamCst } from '../utils/cst-utils.js';
import { BiMap, type LangiumCoreServices, assertType, type ParseResult, assertUnreachable } from '../index.js';
import { type AbstractElement, type Grammar, isAbstractElement } from '../languages/generated/ast.js';
import type { ILexingError, IRecognitionException } from 'chevrotain';

enum InstructionType {
    Allocate,
    Element,
    Property,
    Properties,
    LinkNode,
    LinkNodes,
    Reference,
    References,
    Empty,
    Error,
    Return
}

enum NodeType {
    Cst,
    Ast
}

interface AstAssemblerInstructionBase {
    $type: InstructionType;
}

type ReferenceInfo = {
    refText: string;
    refNode?: number;
};

enum ErrorSource {
    Lexer,
    Parser
}

namespace Instructions {
    export interface Allocate extends AstAssemblerInstructionBase {
        $type: InstructionType.Allocate;
        cstNodeCount: number;
        astNodeCount: number;
    }

    export interface Element extends AstAssemblerInstructionBase {
        $type: InstructionType.Element;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
        value: number;
    }
    export interface Property extends AstAssemblerInstructionBase {
        $type: InstructionType.Property;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
        value: number;
    }
    export interface Properties extends AstAssemblerInstructionBase {
        $type: InstructionType.Properties;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
        values: Array<number | boolean | string | bigint>;
    }
    export interface Reference extends AstAssemblerInstructionBase {
        $type: InstructionType.Reference;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
        refText: string;
        refNode?: number;
    }
    export interface References extends AstAssemblerInstructionBase {
        $type: InstructionType.References;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
        references: ReferenceInfo[];
    }
    export interface LinkNode extends AstAssemblerInstructionBase {
        $type: InstructionType.LinkNode;
        sourceKind: NodeType;
        sourceId: number;
        targetKind: NodeType;
        property: string;
        targetId: number;
    }
    export interface LinkNodes extends AstAssemblerInstructionBase {
        $type: InstructionType.LinkNodes;
        sourceKind: NodeType;
        sourceId: number;
        targetKind: NodeType;
        property: string;
        targetIds: number[];
    }
    export interface Empty extends AstAssemblerInstructionBase {
        $type: InstructionType.Empty;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
    }
    export interface Error extends AstAssemblerInstructionBase {
        $type: InstructionType.Error;
        source: ErrorSource;
        items: Record<string, unknown>;
    }
    export interface Return extends AstAssemblerInstructionBase {
        $type: InstructionType.Return;
        rootAstNodeId: number;
    }
}

export type AstAssemblerInstruction =
    | Instructions.Allocate
    | Instructions.Property
    | Instructions.Element
    | Instructions.Properties
    | Instructions.Reference
    | Instructions.References
    | Instructions.LinkNode
    | Instructions.LinkNodes
    | Instructions.Empty
    | Instructions.Error
    | Instructions.Return;

export interface AstDisassembler {
    disassemble(parseResult: ParseResult<AstNode>): Generator<AstAssemblerInstruction, void, void>;
}

export interface AstReassemblerContext {
    lexerErrors: ILexingError[];
    parserErrors: IRecognitionException[];
    idToAstNode: Array<Record<string, unknown>>;
    idToCstNode: Array<Record<string, unknown>>;
    rootAstNodeId: number;
    elementToId: BiMap<AbstractElement, number>;
}

export interface AstReassembler {
    initializeContext(): AstReassemblerContext;
    reassemble(context: AstReassemblerContext, instr: AstAssemblerInstruction): boolean;
    buildPerseResult<T extends AstNode>(context: AstReassemblerContext): ParseResult<T>;
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
                yield setProperty('tokenType', node.tokenType.name);
                yield setProperty('offset', node.offset);
                yield setProperty('length', node.length);
                yield setProperty('startLine', node.range.start.line);
                yield setProperty('startColumn', node.range.start.character);
                yield setProperty('endLine', node.range.end.line);
                yield setProperty('endColumn', node.range.end.character);
            }
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

            const setReferences = (property: string, references: ReferenceInfo[]) => {
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

            const setReference = (property: string, reference: ReferenceInfo) => {
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
                            yield setReferences(name, value.map(v => (<ReferenceInfo>{
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
                    yield setReference(name, <ReferenceInfo>{
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
                items: { ...error }
            };
        }
        for (const error of parseResult.parserErrors) {
            yield <Instructions.Error>{
                $type: InstructionType.Error,
                source: ErrorSource.Parser,
                items: { ...error }
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

function createGrammarElementIdMap(grammar: Grammar) {
    const result = new BiMap<AbstractElement, number>();
    let id = 0;
    for (const element of streamAst(grammar)) {
        if (isAbstractElement(element)) {
            result.set(element, id++);
        }
    }
    return result;
}

export class DefaultAstReassembler implements AstReassembler {
    private readonly grammarElementIdMap: BiMap<AbstractElement, number>;
    constructor(services: LangiumCoreServices) {
        this.grammarElementIdMap = createGrammarElementIdMap(services.Grammar);
    }

    buildPerseResult<T extends AstNode>(context: AstReassemblerContext): ParseResult<T> {
        return {
            lexerErrors: context.lexerErrors,
            parserErrors: context.parserErrors,
            value: context.idToAstNode[context.rootAstNodeId] as T
        };
    }
    initializeContext(): AstReassemblerContext {
        return {
            rootAstNodeId: -1,
            idToAstNode: [],
            idToCstNode: [],
            lexerErrors: [],
            parserErrors: [],
            elementToId: this.grammarElementIdMap
        };
    }

    reassemble(ctx: AstReassemblerContext, instr: AstAssemblerInstruction): boolean {
        switch (instr.$type) {
            case InstructionType.Allocate:
                ctx.idToCstNode = Array.from({ length: instr.cstNodeCount }).map(() => ({} as Mutable<CstNode>));
                ctx.idToAstNode = Array.from({ length: instr.astNodeCount }).map(() => ({} as Mutable<AstNode>));
                break;
            case InstructionType.Empty:
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = [];
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = [];
                }
                break;
            case InstructionType.Element:
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = ctx.elementToId.getKey(instr.value);
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = ctx.elementToId.getKey(instr.value);
                }
                break;
            case InstructionType.Property:
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = instr.value;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = instr.value;
                }
                break;
            case InstructionType.Properties:
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = instr.values;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = instr.values;
                }
                break;
            case InstructionType.Reference: {
                const reference = <Reference>{
                    $refText: instr.refText,
                    $refNode: instr.refNode ? ctx.idToCstNode[instr.refNode] : undefined
                };
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = reference;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = reference;
                }
                break;
            }
            case InstructionType.References: {
                const references = instr.references.map(r => (<Reference>{
                    $refText: r.refText,
                    $refNode: r.refNode ? ctx.idToCstNode[r.refNode] : undefined
                }));
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = references;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = references;
                }
                break;
            }
            case InstructionType.LinkNode: {
                const node = instr.targetKind === NodeType.Ast ? ctx.idToAstNode[instr.targetId] : ctx.idToCstNode[instr.targetId];
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = node;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = node;
                }
                break;
            }
            case InstructionType.LinkNodes: {
                const nodes = instr.targetKind === NodeType.Ast
                    ? instr.targetIds.map(id => ctx.idToAstNode[id])
                    : instr.targetIds.map(id => ctx.idToCstNode[id])
                    ;
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = nodes;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = nodes;
                }
                break;
            }
            case InstructionType.Return:
                ctx.rootAstNodeId = instr.rootAstNodeId;
                return true;
            case InstructionType.Error:
                if (instr.source === ErrorSource.Lexer) {
                    ctx.lexerErrors.push({ ...instr.items } as unknown as ILexingError);
                } else {
                    ctx.parserErrors.push({ ...instr.items } as unknown as IRecognitionException);
                }
                break;
            default:
                assertUnreachable(instr);
        }
        return false;
    }
}
