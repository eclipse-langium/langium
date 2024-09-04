/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable dot-notation */

import { beforeEach, describe, expect, test } from 'vitest';
import type { DefaultDocumentBuilder} from 'langium';
import { DocumentCache, EmptyFileSystem, URI, WorkspaceCache } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';

const services = createLangiumGrammarServices(EmptyFileSystem);
const workspace = services.shared.workspace;
const document1 = workspace.LangiumDocumentFactory.fromString('', URI.file('/document1.langium'));
workspace.TextDocuments.set(document1.textDocument);
const document2 = workspace.LangiumDocumentFactory.fromString('', URI.file('/document2.langium'));
workspace.TextDocuments.set(document2.textDocument);
workspace.LangiumDocuments.addDocument(document1);
workspace.LangiumDocuments.addDocument(document2);

describe('Document Cache', () => {

    beforeEach(async () => {
        // Rebuild both documents to ensure that the following build calls don't pick up on other documents
        await workspace.DocumentBuilder.build([document1, document2]);
    });

    test('Should get, set, has and delete on separate documents', () => {
        const cache = new DocumentCache<string, string>(services.shared);
        expect(cache.has(document1.uri, 'key')).toBe(false);
        cache.set(document1.uri, 'key', 'document1');
        expect(cache.has(document1.uri, 'key')).toBe(true);
        expect(cache.get(document1.uri, 'key')).toBe('document1');
        cache.set(document2.uri, 'key', 'document2');
        // The previous line should not change the value for document1
        expect(cache.get(document1.uri, 'key')).toBe('document1');
        // The value for document2 has been set correctly
        expect(cache.get(document2.uri, 'key')).toBe('document2');
        expect(cache.delete(document1.uri, 'key')).toBe(true);
        // Calling delete a second time should return false
        expect(cache.delete(document1.uri, 'key')).toBe(false);
        expect(cache.has(document1.uri, 'key')).toBe(false);
        cache.dispose();
    });

    test('Should get with provider', () => {
        const cache = new DocumentCache<string, string>(services.shared);
        expect(cache.has(document1.uri, 'key')).toBe(false);
        expect(cache.get(document1.uri, 'key', () => 'document1')).toBe('document1');
        expect(cache.has(document1.uri, 'key')).toBe(true);
        cache.dispose();
    });

    test('Set value should be reset on document update', async () => {
        const cache = new DocumentCache<string, string>(services.shared);
        cache.set(document1.uri, 'key', 'document1');
        cache.set(document2.uri, 'key', 'document2');
        await workspace.DocumentBuilder.update([document1.uri], []);
        // The previous line should clear the cache for document1
        expect(cache.has(document1.uri, 'key')).toBe(false);
        expect(cache.get(document1.uri, 'key')).toBe(undefined);
        // The cache for document2 should be unaffected
        expect(cache.get(document2.uri, 'key')).toBe('document2');
        cache.dispose();
    });

    test('Document cache can be property disposed', async () => {
        const documentBuilder = workspace.DocumentBuilder as DefaultDocumentBuilder;
        const listenerCount = documentBuilder['updateListeners'].length;
        const cache = new DocumentCache<string, string>(services.shared);
        // Listener count should have increased by one
        expect(documentBuilder['updateListeners'].length).toBe(listenerCount + 1);
        cache.dispose();
        // Listener count is back to previous value
        expect(documentBuilder['updateListeners'].length).toBe(listenerCount);
        expect(() => cache.get(document1.uri, 'key')).toThrow();
        expect(() => cache.has(document1.uri, 'key')).toThrow();
        expect(() => cache.set(document1.uri, 'key', 'value')).toThrow();
        expect(() => cache.delete(document1.uri, 'key')).toThrow();
        expect(() => cache.clear(document1.uri)).toThrow();
        expect(() => cache.clear()).toThrow();
    });

});

describe('Workspace Cache', () => {

    beforeEach(async () => {
        // Rebuild both documents to ensure that the following build calls don't pick up on other documents
        await workspace.DocumentBuilder.build([document1, document2]);
    });

    test('Should get and set on the whole workspace', () => {
        const cache = new WorkspaceCache<string, string>(services.shared);
        expect(cache.has('key')).toBe(false);
        cache.set('key', 'workspace');
        expect(cache.has('key')).toBe(true);
        expect(cache.get('key')).toBe('workspace');
        expect(cache.delete('key')).toBe(true);
        // Calling delete a second time should return false
        expect(cache.delete('key')).toBe(false);
        expect(cache.has('key')).toBe(false);
        cache.dispose();
    });

    test('Whole cache should be reset on document update', async () => {
        const cache = new WorkspaceCache<string, string>(services.shared);
        cache.set('key', 'workspace');
        await workspace.DocumentBuilder.update([document1.uri], []);
        expect(cache.has('key')).toBe(false);
        expect(cache.get('key')).toBe(undefined);
        cache.dispose();
    });

    test('Workspace cache can be property disposed', async () => {
        const documentBuilder = workspace.DocumentBuilder as DefaultDocumentBuilder;
        const listenerCount = documentBuilder['updateListeners'].length;
        const cache = new WorkspaceCache<string, string>(services.shared);
        // Listener count should have increased by one
        expect(documentBuilder['updateListeners'].length).toBe(listenerCount + 1);
        cache.dispose();
        // Listener count is back to previous value
        expect(documentBuilder['updateListeners'].length).toBe(listenerCount);
        expect(() => cache.get('key')).toThrow();
        expect(() => cache.has('key')).toThrow();
        expect(() => cache.set('key', 'value')).toThrow();
        expect(() => cache.delete('key')).toThrow();
        expect(() => cache.clear()).toThrow();
    });
});
