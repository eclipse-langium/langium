/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TextDocument, TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument';
import { TextDocuments, TextDocumentsConfiguration } from 'vscode-languageserver/node';
import { AstNode } from '../syntax-tree';
import { ParseResult } from '../parser/langium-parser';
import { AstNodeDescription } from '../references/scope';

export interface LangiumDocument extends TextDocument {
    parseResult?: ParseResult
    precomputedScopes?: PrecomputedScopes
    outdated?: boolean;
}

export type PrecomputedScopes = Map<AstNode, AstNodeDescription[]>

export const LangiumDocumentConfiguration: TextDocumentsConfiguration<LangiumDocument> = {
    create(uri: string, languageId: string, version: number, content: string): LangiumDocument {
        return TextDocument.create(uri, languageId, version, content);
    },
    update(document: LangiumDocument, changes: TextDocumentContentChangeEvent[], version: number): LangiumDocument {
        return TextDocument.update(document, changes, version);
    }
};

/**
 * TODO: This map should be in sync with TextDocuments service in sense that:
 *   - A LangiumDocument only contains in TextDocuments or precomputedDocuments but never both
 *   - A LangiumDocument is properly unloaded and all references to it are invalidated when switching
 *     from precomputedDocuments to TextDocuments (i.e. user opens a precomuted LangiumDocument)
 *   - Think about to do it better than what follows below
 */
const precomputedDocuments: Map<string, LangiumDocument> = new Map<string, LangiumDocument>();

export function createOrGetDocument(uri: string, opened: TextDocuments<LangiumDocument>, creator: (uri: string) => LangiumDocument): LangiumDocument {
    const openedDoc = opened.get(uri);
    if (openedDoc)
        return openedDoc;
    let precomputedDoc = precomputedDocuments.get(uri);
    if (!precomputedDoc) {
        precomputedDoc = creator(uri);
        precomputedDocuments.set(uri, precomputedDoc);
    }
    return precomputedDoc;
}

export function invalidateDocument(uri: string): void {
    const exists = precomputedDocuments.get(uri);
    if(exists) {
        exists.outdated = true;
        precomputedDocuments.delete(uri);
    }
}

export function invalidateAllDocument(): void {
    precomputedDocuments.forEach((doc) => doc.outdated = true);
    precomputedDocuments.clear();
}