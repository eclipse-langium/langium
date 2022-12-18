/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from '../../workspace/documents';
import { Action, Grammar, Interface, ParserRule, Type } from '../generated/ast';
import { Property, TypeOption } from '../type-system/type-collector/types';

/**
 * A Langium document holds the parse result (AST and CST) and any additional state that is derived
 * from the AST, e.g. the result of scope precomputation.
 */
export interface LangiumGrammarDocument extends LangiumDocument<Grammar> {
    validationResources?: ValidationResources
}

export type ValidationResources = {
    typeToValidationInfo: TypeToValidationInfo,
    typeToSuperProperties: Map<string, Property[]>,
    typeToAliases: Map<string, Set<string>>,
}

export type TypeToValidationInfo = Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>;

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
