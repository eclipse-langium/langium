/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { describe, expect, test } from 'vitest';
import { DocumentState, EmptyFileSystem, TextDocument } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { CancellationToken } from 'vscode-languageserver';

describe('DefaultLangiumDocumentFactory', () => {

    test('updates document when receiving a new text', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const uri = 'file:///test.langium';
        const document = documentFactory.fromTextDocument<Grammar>(createTextDocument(uri, 'grammar X', services));
        expect(document.state).toBe(DocumentState.Parsed);
        expect(document.parseResult.value.name).toBe('X');
        document.state = DocumentState.Changed;
        // Update the document with a different text.
        createTextDocument(uri, 'grammar Y', services);
        const updated = await documentFactory.update(document, CancellationToken.None);
        expect(updated.state).toBe(DocumentState.Parsed);
        // Assert that the parse result was updated.
        expect(updated.parseResult.value.name).toBe('Y');
    });

    test('does not update document when receiving the same text', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const uri = 'file:///test.langium';
        const document = documentFactory.fromTextDocument<Grammar>(createTextDocument(uri, 'grammar X', services));
        expect(document.parseResult.value.name).toBe('X');
        // We set a new name value here. When the document is updated, this value should be preserved.
        document.parseResult.value.name = 'HELLO';
        expect(document.parseResult.value.name).toBe('HELLO');
        document.state = DocumentState.Changed;
        // Update the document with the same text.
        createTextDocument(uri, 'grammar X', services);
        const updated = await documentFactory.update(document, CancellationToken.None);
        // Confirm that the parse result wasn't updated.
        expect(updated.parseResult.value.name).toBe('HELLO');
    });
});

function createTextDocument(uri: string, text: string, services: LangiumServices): TextDocument {
    const document = TextDocument.create(uri, 'langium', 0, text);
    services.shared.workspace.TextDocuments.set(document);
    return document;
}
