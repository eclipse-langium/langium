/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CompositeCstNode, Reference, RootCstNode } from '../../syntax-tree.js';
import { type AstNode, type CstNode, type Mutable } from '../../syntax-tree.js';
import { BiMap, type LangiumCoreServices, type ParseResult, assertUnreachable, RootCstNodeImpl, CompositeCstNodeImpl, LeafCstNodeImpl } from '../../index.js';
import { type AbstractElement } from '../../languages/generated/ast.js';
import type { ILexingError, IRecognitionException, TokenType } from 'chevrotain';
import type { AstAssemblerInstruction} from './AstAssemblerInstruction.js';
import { InstructionType, NodeType, ErrorSource, createGrammarElementIdMap } from './AstAssemblerInstruction.js';

export interface AstReassemblerContext {
    lexerErrors: ILexingError[];
    parserErrors: IRecognitionException[];
    idToAstNode: Array<Record<string, unknown>>;
    idToCstNode: CstNode[];
    nextFreeCstNode: number;
    cstStack: CompositeCstNode[];
    rootCstNodeId: number;
    rootAstNodeId: number;
    elementToId: BiMap<AbstractElement, number>;
}

export interface AstReassembler {
    reassemble(context: AstReassemblerContext, instr: AstAssemblerInstruction): boolean;
    buildParseResult<T extends AstNode>(context: AstReassemblerContext): ParseResult<T>;
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

    reassemble(ctx: AstReassemblerContext, instr: AstAssemblerInstruction): boolean {
        switch (instr.$type) {
            case InstructionType.Allocate:
                ctx.rootAstNodeId = -1;
                ctx.rootCstNodeId = -1;
                ctx.idToAstNode = [];
                ctx.idToCstNode = [];
                ctx.nextFreeCstNode = 0;
                ctx.cstStack = [];
                ctx.lexerErrors = [];
                ctx.parserErrors = [];
                ctx.elementToId = this.grammarElementIdMap;
                ctx.idToCstNode = Array.from({ length: instr.cstNodeCount }).map(() => (undefined! as Mutable<CstNode>));
                ctx.idToAstNode = Array.from({ length: instr.astNodeCount }).map(() => ({} as Mutable<AstNode>));
                break;
            case InstructionType.Empty:
                ctx.idToAstNode[instr.sourceId][instr.property] = [];
                break;
            case InstructionType.Property:
                ctx.idToAstNode[instr.sourceId][instr.property] = instr.value;
                break;
            case InstructionType.PropertyArray:
                ctx.idToAstNode[instr.sourceId][instr.property] = instr.values;
                break;
            case InstructionType.Reference: {
                const reference = <Reference>{
                    $refText: instr.refText,
                    $refNode: instr.refNode ? ctx.idToCstNode[instr.refNode] : undefined
                };
                ctx.idToAstNode[instr.sourceId][instr.property] = reference;
                break;
            }
            case InstructionType.ReferenceArray: {
                const references = instr.references.map(r => (<Reference>{
                    $refText: r.refText,
                    $refNode: r.refNode ? ctx.idToCstNode[r.refNode] : undefined
                }));
                ctx.idToAstNode[instr.sourceId][instr.property] = references;
                break;
            }
            case InstructionType.LinkNode: {
                const node = instr.targetKind === NodeType.Ast ? ctx.idToAstNode[instr.targetId] : ctx.idToCstNode[instr.targetId];
                ctx.idToAstNode[instr.sourceId][instr.property] = node;
                break;
            }
            case InstructionType.LinkNodeArray: {
                const nodes = instr.targetKind === NodeType.Ast
                    ? instr.targetIds.map(id => ctx.idToAstNode[id])
                    : instr.targetIds.map(id => ctx.idToCstNode[id])
                    ;
                ctx.idToAstNode[instr.sourceId][instr.property] = nodes;
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
            case InstructionType.RootCstNode: {
                const index = ctx.nextFreeCstNode++;
                const rootNode = ctx.idToCstNode[index] = new RootCstNodeImpl(instr.input);
                rootNode.astNode = typeof instr.astNodeId === 'number' ? ctx.idToAstNode[instr.astNodeId] as unknown as AstNode : undefined;
                rootNode.root = rootNode;
                ctx.cstStack = [rootNode];
                ctx.rootCstNodeId = index;
                break;
            }
            case InstructionType.CompositeCstNode: {
                const index = ctx.nextFreeCstNode++;
                const compositeNode = ctx.idToCstNode[index] = new CompositeCstNodeImpl();
                compositeNode.grammarSource = ctx.elementToId.getKey(instr.elementId)!;
                compositeNode.astNode = typeof instr.astNodeId === 'number' ? ctx.idToAstNode[instr.astNodeId] as unknown as AstNode : undefined;
                compositeNode.root = ctx.idToCstNode[ctx.rootCstNodeId] as RootCstNode;
                const current = ctx.cstStack[ctx.cstStack.length-1];
                current.content.push(compositeNode);
                ctx.cstStack.push(compositeNode);
                break;
            }
            case InstructionType.LeafCstNode: {
                const index = ctx.nextFreeCstNode++;
                const tokenType = this.grammarTokenTypeIdMap.getKey(instr.tokenTypeName)!;
                const leafNode = ctx.idToCstNode[index] = new LeafCstNodeImpl(instr.tokenOffset, instr.tokenLength, instr.range, tokenType, instr.hidden);
                leafNode.grammarSource = ctx.elementToId.getKey(instr.elementId)!;
                leafNode.astNode = typeof instr.astNodeId === 'number' ? ctx.idToAstNode[instr.astNodeId] as unknown as AstNode : undefined;
                leafNode.root = ctx.idToCstNode[ctx.rootCstNodeId] as RootCstNode;
                const current = ctx.cstStack[ctx.cstStack.length-1];
                current.content.push(leafNode);
                break;
            }
            case InstructionType.PopCstNode: {
                ctx.cstStack.pop();
                break;
            }
            default:
                assertUnreachable(instr);
        }
        return false;
    }
}
