/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export const INSPECT_AST_REQUEST = 'langium/inspect/ast';
export const AST_CHANGED_NOTIFICATION = 'langium/inspect/astChanged';

export interface InspectAstOptions {
    textRegions?: boolean;
    refText?: boolean;
    sourceText?: boolean;
    comments?: boolean;
}

export interface InspectAstParams {
    uri: string;
    options?: InspectAstOptions;
}

export interface InspectAstSuccess {
    uri: string;
    languageId: string;
    ast: string;
}

export interface InspectAstError {
    uri: string;
    error: string;
}

export type InspectAstResult = InspectAstSuccess | InspectAstError;

export interface AstChangedParams {
    uri: string;
}

export function isInspectAstError(result: InspectAstResult): result is InspectAstError {
    return 'error' in result;
}
