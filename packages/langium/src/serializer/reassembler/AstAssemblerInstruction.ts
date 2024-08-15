/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Range } from 'vscode-languageserver-protocol';
import type { Grammar, AbstractElement} from '../../languages/generated/ast.js';
import { isAbstractElement } from '../../languages/generated/ast.js';
import { streamAst } from '../../utils/ast-utils.js';
import { BiMap } from '../../utils/collections.js';

export enum InstructionType {
    //setup
    Allocate,
    Error,
    Return,

    //CST
    RootCstNode,
    CompositeCstNode,
    LeafCstNode,
    PopCstNode,

    //AST
    Property,
    PropertyArray,
    LinkNode,
    LinkNodeArray,
    Reference,
    ReferenceArray,
    Empty
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
    export interface Property extends AstAssemblerInstructionBase {
        $type: InstructionType.Property;
        sourceId: number;
        property: string;
        value: number | boolean | string | bigint;
    }
    export interface PropertyArray extends AstAssemblerInstructionBase {
        $type: InstructionType.PropertyArray;
        sourceId: number;
        property: string;
        values: Array<number | boolean | string | bigint>;
    }
    export interface Reference extends AstAssemblerInstructionBase {
        $type: InstructionType.Reference;
        sourceId: number;
        property: string;
        refText: string;
        refNode?: number;
    }
    export interface ReferenceArray extends AstAssemblerInstructionBase {
        $type: InstructionType.ReferenceArray;
        sourceId: number;
        property: string;
        references: ReferenceData[];
    }
    export interface LinkNode extends AstAssemblerInstructionBase {
        $type: InstructionType.LinkNode;
        sourceId: number;
        targetKind: NodeType;
        property: string;
        targetId: number;
    }
    export interface LinkNodeArray extends AstAssemblerInstructionBase {
        $type: InstructionType.LinkNodeArray;
        sourceId: number;
        targetKind: NodeType;
        property: string;
        targetIds: number[];
    }
    export interface Empty extends AstAssemblerInstructionBase {
        $type: InstructionType.Empty;
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

    export interface RootCstNode extends AstAssemblerInstructionBase {
        $type: InstructionType.RootCstNode;
        input: string;
        astNodeId: number|undefined;
    }
    export interface CompositeCstNode extends AstAssemblerInstructionBase {
        $type: InstructionType.CompositeCstNode;
        elementId: number;
        astNodeId: number|undefined;
    }
    export interface LeafCstNode extends AstAssemblerInstructionBase {
        $type: InstructionType.LeafCstNode;
        tokenOffset: number;
        tokenLength: number;
        tokenTypeName: string;
        elementId: number;
        hidden: boolean;
        range: Range;
        astNodeId: number|undefined;
    }
    export interface PopCstNode extends AstAssemblerInstructionBase {
        $type: InstructionType.PopCstNode;
    }
}

export type AstAssemblerInstruction =
| Instructions.Allocate
| Instructions.Property
| Instructions.PropertyArray
| Instructions.Reference
| Instructions.ReferenceArray
| Instructions.LinkNode
| Instructions.LinkNodeArray
| Instructions.Empty
| Instructions.Error
| Instructions.Return
| Instructions.RootCstNode
| Instructions.CompositeCstNode
| Instructions.LeafCstNode
| Instructions.PopCstNode
;

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
