/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Grammar } from 'langium';
import type { LangiumServices } from 'langium/lsp';
import { describe, expect, test } from 'vitest';
import { DefaultWorkspaceManager, DocumentState, EmptyFileSystem, TextDocument, URI } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { CancellationToken } from 'vscode-languageserver';
import { NodeFileSystem } from '../../src/node/node-file-system-provider.js';

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

    test('Handle invalid URIs in the EmptyFileSystem', async () => {
        // const services = createLangiumGrammarServices(NodeFileSystem).grammar;
        const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const uri = URI.parse('file:///file/does/not/exist.langium');
        const document = await documentFactory.fromUri(uri);
        expect(document).not.toBe(undefined);
        expect(document.textDocument.getText().trim()).toBe("// 'file:///file/does/not/exist.langium' does not exist in the file system");
    });

    test('Handle invalid URIs in the NodeFileSystem', async () => {
        const services = createLangiumGrammarServices(NodeFileSystem).grammar;
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const uri = URI.parse('file:///file/does/not/exist.langium');
        const document = await documentFactory.fromUri(uri);
        expect(document).not.toBe(undefined);
        expect(document.textDocument.getText().trim()).toBe("// 'file:///file/does/not/exist.langium' does not exist in the file system");
    });

    test('Dont crash the LS initialization with invalid URIs', async () => {
        class TestWorkspaceManager extends DefaultWorkspaceManager {
            protected override traverseFolder(folderPath: URI, uris: URI[]): Promise<void> {
                uris.push(URI.parse('file:///file/does/not/exist.langium'));
                return super.traverseFolder(folderPath, uris);
            }
        }
        const services = createLangiumGrammarServices(NodeFileSystem, { workspace: { WorkspaceManager: services => new TestWorkspaceManager(services) }}).grammar;
        await services.shared.workspace.WorkspaceManager.initializeWorkspace([{ name: 'init', uri: 'start-somewhere' }]);
        const documents = services.shared.workspace.LangiumDocuments.all.toArray();
        expect(documents).toHaveLength(1);
        expect(documents[0].textDocument.getText().trim()).toBe("// 'file:///file/does/not/exist.langium' does not exist in the file system");
    });

});

function createTextDocument(uri: string, text: string, services: LangiumServices): TextDocument {
    const document = TextDocument.create(uri, 'langium', 0, text);
    services.shared.workspace.TextDocuments.set(document);
    return document;
}
