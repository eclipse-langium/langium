/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumDocument } from '../../workspace/documents.js';
import type { Action, Grammar, Interface, ParserRule, Type } from '../../languages/generated/ast.js';
import type { Property, TypeOption } from '../type-system/type-collector/types.js';

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

export function getTypeOption(info: InferredInfo | DeclaredInfo): TypeOption {
    return isDeclared(info) ? info.declared : info.inferred;
}
