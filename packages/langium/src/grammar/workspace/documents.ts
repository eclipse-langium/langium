/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from '../../workspace/documents';
import { Action, Grammar, Interface, ParserRule, Type } from '../generated/ast';
import { InterfaceType, Property, UnionType } from '../type-system/types-util';

/**
 * A Langium document holds the parse result (AST and CST) and any additional state that is derived
 * from the AST, e.g. the result of scope precomputation.
 */
export interface LangiumGrammarDocument extends LangiumDocument<Grammar> {
    validationResources?: ValidationResources;
    typeToItsSuperProperties?: Map<string, Property[]>;
}

export type ValidationResources = Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>;

export type TypeOption = UnionType | InterfaceType;

export function isUnionType(type: TypeOption): type is UnionType {
    return type && 'union' in type;
}

export function isInterfaceType(type: TypeOption): type is InterfaceType {
    return type && 'properties' in type;
}

export type InferredInfo = {
    inferred: TypeOption,
    inferredNodes: ReadonlyArray<ParserRule | Action>
}

export type DeclaredInfo = {
    declared: TypeOption,
    declaredNode: Type | Interface,
}

export function isDeclared(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is DeclaredInfo {
    return type && 'declared' in type;
}

export function isInferred(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is InferredInfo {
    return type && 'inferred' in type;
}

export function isInferredAndDeclared(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is InferredInfo & DeclaredInfo {
    return type && 'inferred' in type && 'declared' in type;
}
