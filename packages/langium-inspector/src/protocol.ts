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

/** Extension ID of the Langium VS Code extension that hosts the AST Inspector. */
export const LANGIUM_VSCODE_EXTENSION_ID = 'langium.langium-vscode';

/**
 * Minimal subset of `LanguageClient` used by the AST Inspector. Declared structurally so this
 * package needs no `vscode-languageclient` dependency; a `LanguageClient` satisfies it.
 */
export interface InspectorClient {
    sendRequest<R>(method: string, param: unknown): Promise<R>;
    onNotification(method: string, handler: (params: unknown) => void): { dispose(): void };
}

/** API returned by the Langium VS Code extension's `activate()`. */
export interface LangiumInspectorApi {
    registerLangiumInspector(client: InspectorClient, languageId: string): { dispose(): void };
}
