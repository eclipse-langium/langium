/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Reference, RootCstNode } from '../../syntax-tree.js';
import { type AstNode, type CstNode, type Mutable } from '../../syntax-tree.js';
import { BiMap, type LangiumCoreServices, type ParseResult, assertUnreachable } from '../../index.js';
import { type AbstractElement } from '../../languages/generated/ast.js';
import type { ILexingError, IRecognitionException, TokenType } from 'chevrotain';
import type { AstAssemblerInstruction} from './AstAssemblerInstruction.js';
import { InstructionType, NodeType, ErrorSource, createGrammarElementIdMap } from './AstAssemblerInstruction.js';

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
    buildParseResult<T extends AstNode>(context: AstReassemblerContext): ParseResult<T>;
}

class CstClone {
    root: RootCstNode;
    offset: number;
    length: number;
    get end() {
        return this.offset + this.length;
    }
    get text() {
        return this.root.fullText.substring(this.offset, this.end);
    }
}

export class DefaultAstReassembler implements AstReassembler {
    private readonly grammarElementIdMap: BiMap<AbstractElement, number>;
    private readonly grammarTokenTypeIdMap: BiMap<TokenType, string>;
    constructor(services: LangiumCoreServices) {
        this.grammarElementIdMap = createGrammarElementIdMap(services.Grammar);
        const tokens = services.parser.TokenBuilder.buildTokens(services.Grammar) as TokenType[];
        this.grammarTokenTypeIdMap = new BiMap(tokens.map(tk => [tk, tk.name] as const));
    }

    buildParseResult<T extends AstNode>(context: AstReassemblerContext): ParseResult<T> {
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
                ctx.idToCstNode = Array.from({ length: instr.cstNodeCount }).map(() => (new CstClone() as Mutable<CstNode>));
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
            case InstructionType.TokenType: {
                const tokenType = this.grammarTokenTypeIdMap.getKey(instr.tokenName)!;
                if (instr.sourceKind === NodeType.Ast) {
                    ctx.idToAstNode[instr.sourceId][instr.property] = tokenType;
                } else {
                    ctx.idToCstNode[instr.sourceId][instr.property] = tokenType;
                }
                break;
            }
            default:
                assertUnreachable(instr);
        }
        return false;
    }
}
