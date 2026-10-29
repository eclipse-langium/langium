/******************************************************************************
 * Copyright 2026 Eclipse Langium contributors.
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Deferred, delayNextTick, DocumentState, OperationCancelled, TextDocument, URI, type AstNode } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { addCodeLensHandler, WorkspaceState, type CodeLensProvider, type SharedCodeLensProvider, type ServiceRequirement } from 'langium/lsp';
import { describe, expect, test, vi } from 'vitest';
import { CancellationToken, CancellationTokenSource, LSPErrorCodes, Range, ResponseError, type CodeLens, type Connection } from 'vscode-languageserver';

const grammar = `
grammar CodeLensTest
entry Model: name=ID;
terminal ID: /[a-zA-Z]+/;
hidden terminal WS: /\\s+/;
`;

interface Model extends AstNode {
    name: string;
}

function lens(title?: string): CodeLens {
    return {
        range: Range.create(0, 0, 0, 4),
        ...(title ? { command: { title, command: 'test.command' } } : {})
    };
}

async function setup(options: {
    shared?: SharedCodeLensProvider;
    first?: CodeLensProvider;
    second?: CodeLensProvider;
    requiredState?: ServiceRequirement;
} = {}) {
    const services = await createServicesForGrammar({
        grammar,
        languageMetaData: { languageId: 'first', fileExtensions: ['.first'], caseInsensitive: false, mode: 'development' },
        module: { lsp: { CodeLensProvider: () => options.first } },
        sharedModule: { lsp: { CodeLensProvider: () => options.shared } }
    });
    const secondLanguage = {
        ...services,
        LanguageMetaData: { ...services.LanguageMetaData, languageId: 'second', fileExtensions: ['.second'] },
        lsp: { ...services.lsp, CodeLensProvider: options.second }
    };
    services.shared.ServiceRegistry.register(secondLanguage);

    // Capture registered handlers to test routing and locking.
    const onCodeLens = vi.fn<Connection['onCodeLens']>();
    const onCodeLensResolve = vi.fn<Connection['onCodeLensResolve']>();
    const connection = { onCodeLens, onCodeLensResolve } as unknown as Connection;
    addCodeLensHandler(connection, services.shared, options.requiredState);

    const { capabilities } = await services.shared.lsp.LanguageServer.initialize({
        processId: null, rootUri: null, capabilities: {}
    });
    const workspace = services.shared.workspace;
    await workspace.WorkspaceManager.initializeWorkspace([]);
    const documents = ['first', 'second'].map(extension => {
        const document = workspace.LangiumDocumentFactory.fromString<Model>('Test', URI.parse(`file:///test.${extension}`));
        workspace.LangiumDocuments.addDocument(document);
        return document;
    });
    await workspace.DocumentBuilder.build(documents);

    return {
        services, capabilities, workspace, documents, onCodeLensResolve,
        provide: (index = 0, token = CancellationToken.None) => onCodeLens.mock.calls[0][0](
            { textDocument: { uri: documents[index].uri.toString() } }, token, undefined!
        ),
        resolve: (item: CodeLens, token = CancellationToken.None) => onCodeLensResolve.mock.calls[0][0](item, token)
    };
}

async function pauseUpdate(context: Awaited<ReturnType<typeof setup>>, phase = DocumentState.Parsed) {
    const { workspace, documents } = context;
    const entered = new Deferred();
    const release = new Deferred();
    const listener = workspace.DocumentBuilder.onBuildPhase(phase, async () => {
        entered.resolve();
        await release.promise;
    });
    workspace.TextDocuments.set(TextDocument.create(documents[0].uri.toString(), 'first', 1, 'Changed'));
    const write = workspace.WorkspaceLock.write(token => workspace.DocumentBuilder.update([documents[0].uri], [], token));
    await entered.promise;
    return { write, release, listener };
}

describe('Code lenses', () => {
    test.each([
        {
            name: 'no providers',
            options: {},
            expected: undefined
        },
        {
            name: 'language provider',
            options: { first: { provideCodeLens: () => [] } },
            expected: { resolveProvider: false }
        },
        {
            name: 'shared provider without resolution',
            options: { shared: { provideCodeLens: () => [] } },
            expected: { resolveProvider: false }
        },
        {
            name: 'shared provider with resolution',
            options: { shared: { provideCodeLens: () => [], resolveCodeLens: (item: CodeLens) => item } },
            expected: { resolveProvider: true }
        }
    ])('Advertises capabilities for $name', async ({ options, expected }) => {
        const context = await setup(options);
        expect(context.capabilities.codeLensProvider).toEqual(expected);
        expect(context.onCodeLensResolve).toHaveBeenCalledTimes(expected?.resolveProvider ? 1 : 0);
    });

    test('Falls back to the provider of each language when no shared provider is registered', async () => {
        const first = { provideCodeLens: vi.fn(() => [lens('first')]) };
        const second = { provideCodeLens: vi.fn(() => [lens('second')]) };
        const context = await setup({ first, second });
        expect(await context.provide(0)).toEqual([lens('first')]);
        expect(await context.provide(1)).toEqual([lens('second')]);
        expect(first.provideCodeLens).toHaveBeenCalledTimes(1);
        expect(second.provideCodeLens).toHaveBeenCalledTimes(1);
    });

    test('Returns no lenses for a language without a provider', async () => {
        const context = await setup({ first: { provideCodeLens: () => [lens('first')] } });
        expect(await context.provide(1)).toBeNull();
    });

    test('Uses the shared provider for both languages and passes the document and token', async () => {
        const shared = { provideCodeLens: vi.fn(() => [lens('shared')]) };
        const local = { provideCodeLens: vi.fn(() => [lens('local')]) };
        const context = await setup({ shared, first: local, second: local });
        for (const index of [0, 1]) {
            expect(await context.provide(index)).toEqual([lens('shared')]);
            expect(shared.provideCodeLens).toHaveBeenNthCalledWith(index + 1,
                context.documents[index], { textDocument: { uri: context.documents[index].uri.toString() } }, CancellationToken.None);
        }
        expect(local.provideCodeLens).not.toHaveBeenCalled();
    });

    test.each([{ result: undefined }, { result: [] }])('Does not fall back when the shared provider returns $result', async ({ result }) => {
        const local = { provideCodeLens: vi.fn(() => [lens('local')]) };
        const context = await setup({ shared: { provideCodeLens: () => result }, first: local });
        expect(await context.provide()).toEqual(result ?? null);
        expect(local.provideCodeLens).not.toHaveBeenCalled();
    });

    test.each([false, true])('Ignores language-level resolvers (shared provider: %s)', async withSharedProvider => {
        const local = { provideCodeLens: () => [], resolveCodeLens: (item: CodeLens) => item };
        const context = await setup({ first: local, shared: withSharedProvider ? { provideCodeLens: () => [] } : undefined });
        expect(context.capabilities.codeLensProvider).toEqual({ resolveProvider: false });
        expect(context.onCodeLensResolve).not.toHaveBeenCalled();
    });

    test('Preserves lens data, provider binding and cancellation token during resolution', async () => {
        const item = { ...lens(), data: { uri: 'file:///test.first', version: 1, custom: ['value'] } };
        const shared = {
            title: 'resolved',
            provideCodeLens() {
                return [item];
            },
            resolveCodeLens: vi.fn(function(this: { title: string }, codeLens: CodeLens) {
                return { ...codeLens, command: { title: this.title, command: 'test.command' } };
            })
        };
        const context = await setup({ shared });
        const tokenSource = new CancellationTokenSource();
        try {
            expect(await context.provide()).toEqual([item]);
            const result = await context.resolve(item, tokenSource.token);
            expect(result).toEqual({ ...item, command: { title: 'resolved', command: 'test.command' } });
            expect(shared.resolveCodeLens).toHaveBeenCalledWith(item, tokenSource.token);
            expect(item.command).toBeUndefined();
            expect(item.data).toEqual({ uri: 'file:///test.first', version: 1, custom: ['value'] });
        } finally {
            tokenSource.dispose();
        }
    });

    test('Keeps the creation state requirement for shared providers', async () => {
        const shared = { provideCodeLens: vi.fn(() => []) };
        const context = await setup({ shared, requiredState: DocumentState.Validated });
        await context.workspace.DocumentBuilder.build(context.documents, { validation: true });
        expect(context.documents[0].state).toBe(DocumentState.Validated);
        const wait = vi.spyOn(context.workspace.DocumentBuilder, 'waitUntil');
        expect(await context.provide()).toEqual([]);
        expect(shared.provideCodeLens).toHaveBeenCalledTimes(1);
        expect(wait).toHaveBeenCalledWith(DocumentState.Validated, context.documents[0].uri, CancellationToken.None);
    });

    test('Waits for reference indexing by default', async () => {
        const shared = { provideCodeLens: () => [], resolveCodeLens: vi.fn((item: CodeLens) => item) };
        const context = await setup({ shared });
        const paused = await pauseUpdate(context, DocumentState.ComputedScopes);
        const wait = vi.spyOn(context.workspace.DocumentBuilder, 'waitUntil');
        const result = context.resolve(lens());
        try {
            await delayNextTick();
            expect(wait).toHaveBeenCalledWith(DocumentState.IndexedReferences, CancellationToken.None);
            expect(context.documents[0].state).toBe(DocumentState.ComputedScopes);
            expect(shared.resolveCodeLens).not.toHaveBeenCalled();
        } finally {
            paused.release.resolve();
            paused.listener.dispose();
            await Promise.all([paused.write, result]);
        }
        expect(await result).toEqual(lens());
        expect(shared.resolveCodeLens).toHaveBeenCalledTimes(1);
    });

    test.each([
        { name: 'default', requiredState: undefined, expectedCalls: 1 },
        { name: 'state', requiredState: DocumentState.Validated, expectedCalls: 0 },
        { name: 'document', requiredState: { type: 'document' as const, state: DocumentState.Validated }, expectedCalls: 0 },
        { name: 'workspace', requiredState: WorkspaceState.Validated, expectedCalls: 0 }
    ])('Respects the $name requirement during validation', async ({ requiredState, expectedCalls }) => {
        const shared = { provideCodeLens: () => [], resolveCodeLens: vi.fn((item: CodeLens) => item) };
        const context = await setup({ shared, requiredState });
        const entered = new Deferred();
        const release = new Deferred();
        context.services.validation.ValidationRegistry.register<{ Model: Model }>({ Model: async (node) => {
            if (node.name === 'Slow') {
                entered.resolve();
                await release.promise;
            }
        } });
        const other = context.documents[1];
        context.workspace.TextDocuments.set(TextDocument.create(other.uri.toString(), 'second', 1, 'Slow'));
        const write = context.workspace.WorkspaceLock.write(token => context.workspace.DocumentBuilder.update([other.uri], [], token));
        await entered.promise;
        let completed = false;
        const result = Promise.resolve(context.resolve(lens())).then(value => { completed = true; return value; });
        try {
            await delayNextTick();
            expect(completed).toBe(expectedCalls > 0);
            expect(shared.resolveCodeLens).toHaveBeenCalledTimes(expectedCalls);
        } finally {
            release.resolve();
            await Promise.allSettled([write, result]);
        }
        await write;
        expect(await result).toEqual(lens());
        expect(shared.resolveCodeLens).toHaveBeenCalledTimes(1);
    });

    test('Defers subsequent writes once asynchronous resolution has started', async () => {
        const started = new Deferred();
        const release = new Deferred();
        const context = await setup({ shared: {
            provideCodeLens: () => [],
            async resolveCodeLens(item) {
                started.resolve();
                await release.promise;
                return item;
            }
        } });
        const result = context.resolve(lens());
        await started.promise;
        const writer = vi.fn();
        const write = context.workspace.WorkspaceLock.write(writer);
        try {
            await delayNextTick();
            expect(writer).not.toHaveBeenCalled();
        } finally {
            release.resolve();
            await Promise.allSettled([write, result]);
        }
        await result;
        await write;
        expect(writer).toHaveBeenCalledTimes(1);
    });

    test('Returns a cancellation error without invoking an already cancelled resolve', async () => {
        const shared = { provideCodeLens: () => [], resolveCodeLens: vi.fn((item: CodeLens) => item) };
        const context = await setup({ shared });
        expect(await context.resolve(lens(), CancellationToken.Cancelled)).toMatchObject({ code: LSPErrorCodes.RequestCancelled });
        expect(shared.resolveCodeLens).not.toHaveBeenCalled();
    });

    test('Cancels phase waiting before the build finishes', async () => {
        const shared = { provideCodeLens: () => [], resolveCodeLens: vi.fn((item: CodeLens) => item) };
        const context = await setup({ shared });
        const paused = await pauseUpdate(context);
        const source = new CancellationTokenSource();
        try {
            let completed = false;
            const result = Promise.resolve(context.resolve(lens(), source.token)).then(value => { completed = true; return value; });
            await delayNextTick();
            expect(completed).toBe(false);
            expect(context.documents[0].state).toBe(DocumentState.Parsed);
            expect(shared.resolveCodeLens).not.toHaveBeenCalled();
            source.cancel();
            // Must respond even when the blocked write has not been released.
            expect(await result).toMatchObject({ code: LSPErrorCodes.RequestCancelled });
            expect(shared.resolveCodeLens).not.toHaveBeenCalled();
        } finally {
            paused.release.resolve();
            await paused.write;
            paused.listener.dispose();
            source.dispose();
        }
    });

    test('Rechecks cancellation when the workspace phase was already reached', async () => {
        const shared = { provideCodeLens: () => [], resolveCodeLens: vi.fn((item: CodeLens) => item) };
        const context = await setup({ shared });
        const source = new CancellationTokenSource();
        try {
            const result = context.resolve(lens(), source.token);
            source.cancel();
            expect(await result).toMatchObject({ code: LSPErrorCodes.RequestCancelled });
            expect(shared.resolveCodeLens).not.toHaveBeenCalled();
        } finally {
            source.dispose();
        }
    });

    test.each([false, true])('Converts provider cancellation to an LSP error (async: %s)', async asynchronous => {
        const context = await setup({ shared: {
            provideCodeLens: () => [],
            resolveCodeLens() {
                if (asynchronous) {
                    return Promise.reject(OperationCancelled);
                }
                throw OperationCancelled;
            }
        } });
        expect(await context.resolve(lens())).toMatchObject({ code: LSPErrorCodes.RequestCancelled });
    });

    test('Preserves response errors and propagates unexpected provider errors', async () => {
        const responseError = new ResponseError(LSPErrorCodes.RequestFailed, 'Lens source no longer exists');
        const unexpectedError = new Error('Unexpected error');
        const resolver = vi.fn()
            .mockRejectedValueOnce(responseError)
            .mockRejectedValueOnce(unexpectedError);
        const context = await setup({ shared: { provideCodeLens: () => [], resolveCodeLens: resolver } });
        expect(await context.resolve(lens())).toBe(responseError);
        await expect(context.resolve(lens())).rejects.toBe(unexpectedError);
    });
});
