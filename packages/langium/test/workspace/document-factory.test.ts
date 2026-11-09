/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar, LangiumDocument } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { describe, expect, test } from 'vitest';
import { DefaultLangiumDocumentFactory, DocumentState, EmptyFileSystem, TextDocument, URI } from 'langium';
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

    test('closed document: re-parses and updates the text document when the file content changed', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const documentFactory = new TestDocumentFactory(services.shared);
        const uri = URI.parse('file:///test.langium');
        const document = documentFactory.fromString<Grammar>('grammar X', uri);
        document.state = DocumentState.Changed;
        documentFactory.files.set(uri.toString(), 'grammar Y');
        const updated = await documentFactory.update(document, CancellationToken.None);
        expect(updated.parseResult.value.name).toBe('Y');
        expect(updated.textDocument.getText()).toBe('grammar Y');
    });

    test('closed document: keeps the parse result and text when the file content is unchanged', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const documentFactory = new TestDocumentFactory(services.shared);
        const uri = URI.parse('file:///test.langium');
        const document = documentFactory.fromString<Grammar>('grammar X', uri);
        document.parseResult.value.name = 'HELLO';
        document.state = DocumentState.Changed;
        documentFactory.files.set(uri.toString(), 'grammar X');
        const updated = await documentFactory.update(document, CancellationToken.None);
        // Confirm that the parse result wasn't updated.
        expect(updated.parseResult.value.name).toBe('HELLO');
        expect(updated.textDocument.getText()).toBe('grammar X');
    });
});

/**
 * Serves the text of closed documents (no `TextDocuments` entry) from a map instead of the file system.
 */
class TestDocumentFactory extends DefaultLangiumDocumentFactory {
    readonly files = new Map<string, string>();

    protected override async getUpdatedText(document: LangiumDocument): Promise<string> {
        return this.files.get(document.uri.toString())!;
    }
}

function createTextDocument(uri: string, text: string, services: LangiumServices): TextDocument {
    const document = TextDocument.create(uri, 'langium', 0, text);
    services.shared.workspace.TextDocuments.set(document);
    return document;
}
