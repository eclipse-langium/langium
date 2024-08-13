/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, AbstractElement} from '../../languages/generated/ast.js';
import { isAbstractElement } from '../../languages/generated/ast.js';
import { streamAst } from '../../utils/ast-utils.js';
import { BiMap } from '../../utils/collections.js';

export enum InstructionType {
    Allocate,
    Element,
    TokenType,
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
export enum NodeType {
    Cst,
    Ast
}
interface AstAssemblerInstructionBase {
    $type: InstructionType;
}
export type ReferenceData = {
    refText: string;
    refNode?: number;
};
export enum ErrorSource {
    Lexer,
    Parser
}
export namespace Instructions {
    export interface Allocate extends AstAssemblerInstructionBase {
        $type: InstructionType.Allocate;
        cstNodeCount: number;
        astNodeCount: number;
    }
    export interface TokenType extends AstAssemblerInstructionBase {
        $type: InstructionType.TokenType;
        sourceKind: NodeType;
        sourceId: number;
        property: string;
        tokenName: string;
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
        references: ReferenceData[];
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

export type AstAssemblerInstruction = Instructions.Allocate
| Instructions.TokenType
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

export function createGrammarElementIdMap(grammar: Grammar) {
    const result = new BiMap<AbstractElement, number>();
    let id = 0;
    for (const element of streamAst(grammar)) {
        if (isAbstractElement(element)) {
            result.set(element, id++);
        }
    }
    return result;
}
