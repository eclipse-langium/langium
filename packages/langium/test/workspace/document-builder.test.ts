/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, DocumentBuilder, FileSystemProvider, LangiumDocument, LangiumDocumentFactory, LangiumDocuments, Module, Reference, ValidationChecks } from 'langium';
import { AstUtils, DocumentState, TextDocument, URI, isOperationCancelled } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { CancellationToken, CancellationTokenSource } from 'vscode-languageserver';
import { fail } from 'assert';
import type { LangiumServices, LangiumSharedServices, TextDocuments } from 'langium/lsp';

describe('DefaultDocumentBuilder', () => {
    async function createServices(shared?: Module<LangiumSharedServices, object>) {
        const grammar = `
            grammar Test
            entry Model:
                (foos+=Foo | bars+=Bar)*;
            Foo:
                'foo' value=INT bar=[Bar];
            Bar:
                'bar' name=ID;
            terminal INT returns number: /[0-9]+/;
            terminal ID: /[_a-zA-Z][\\w_]*/;
            hidden terminal WS: /\\s+/;
        `;
        const services = await createServicesForGrammar({
            grammar,
            sharedModule: shared,
        });
        const fastChecks: ValidationChecks<TestAstType> = {
            Foo: (node, accept) => {
                if (node.value > 10) {
                    accept('warning', 'Value is too large: ' + node.value, { node });
                }
            }
        };
        services.validation.ValidationRegistry.register(fastChecks);
        const slowChecks: ValidationChecks<TestAstType> = {
            Foo: (node, accept) => {
                if (node.bar.ref && node.bar.ref.name.length > 10) {
                    accept('warning', 'Bar is too long: ' + node.bar.ref.name, { node });
                }
            }
        };
        services.validation.ValidationRegistry.register(slowChecks, null, 'slow');
        return services;
    }

    test('emits `onUpdate` on `update` call', async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = workspace.DocumentBuilder;
        await builder.build([document], {});
        let called = false;
        builder.onUpdate(() => {
            called = true;
        });
        workspace.TextDocuments.set(document.textDocument);
        await builder.update([document.uri], []);
        expect(called).toBe(true);
    });

    test('emits `onUpdate` on `build` call', async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = workspace.DocumentBuilder;
        await builder.build([document], {});
        workspace.TextDocuments.set(document.textDocument);
        let called = false;
        builder.onUpdate(() => {
            called = true;
        });
        await builder.build([document]);
        expect(called).toBe(true);
    });

    test('Check all onBuidPhase callbacks', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = services.shared.workspace.DocumentBuilder;
        const awaiting: Array<Promise<void>> = [];
        builder.onBuildPhase(DocumentState.Parsed, () => {
            awaiting.push(Promise.resolve());
        });
        builder.onBuildPhase(DocumentState.IndexedContent, () => {
            awaiting.push(Promise.resolve());
        });
        builder.onBuildPhase(DocumentState.ComputedScopes, () => {
            awaiting.push(Promise.resolve());
        });
        builder.onBuildPhase(DocumentState.Linked, () => {
            awaiting.push(Promise.resolve());
        });
        builder.onBuildPhase(DocumentState.IndexedReferences, () => {
            awaiting.push(Promise.resolve());
        });
        builder.onBuildPhase(DocumentState.Validated, () => {
            awaiting.push(Promise.resolve());
        });

        await builder.build([document], { validation: true });
        expect(async () => await Promise.all(awaiting)).not.toThrowError();
        expect(document.state).toBe(DocumentState.Validated);
        expect(awaiting.length).toBe(6);
    });

    test('resumes document build after cancellation', async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document1 = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString(`
            foo 1 C
            foo 11 D
            bar C
            bar D
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = workspace.DocumentBuilder;
        const tokenSource1 = new CancellationTokenSource();
        builder.onBuildPhase(DocumentState.IndexedContent, () => {
            tokenSource1.cancel();
        });
        try {
            await builder.build([document1, document2], {}, tokenSource1.token);
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        expect(document1.state).toBe(DocumentState.IndexedContent);
        expect(document2.state).toBe(DocumentState.IndexedContent);

        workspace.TextDocuments.set(document1.textDocument);
        await builder.update([document1.uri], []);
        // While the first document is built with validation due to its reported update, the second one
        // is resumed with its initial build options, which did not include validation.
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);
        expect(document2.state).toBe(DocumentState.IndexedReferences);
        expect(document2.diagnostics).toBeUndefined();
    });

    test('includes document with references to updated document', async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document1 = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString(`
            foo 1 C
            foo 11 A
            bar C
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = workspace.DocumentBuilder;
        await builder.build([document1, document2], {});
        expect(document1.state).toBe(DocumentState.IndexedReferences);
        expect(document1.references.filter(r => r.error !== undefined)).toHaveLength(0);
        expect(document2.state).toBe(DocumentState.IndexedReferences);
        expect(document2.references.filter(r => r.error !== undefined)).toHaveLength(0);

        workspace.TextDocuments.set(document1.textDocument);
        TextDocument.update(document1.textDocument, [{
            // Change `foo 1 A` to `foo 1 D`, breaking the local reference
            range: { start: { line: 1, character: 18 }, end: { line: 1, character: 19 } },
            text: 'D'
        }], 1);
        workspace.TextDocuments.set(document2.textDocument);
        builder.updateBuildOptions = {
            validation: {
                // Only the linking error is reported for the first document
                stopAfterLinkingErrors: true
            }
        };
        await builder.update([document1.uri], []);
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Could not resolve reference to Bar named \'D\'.'
        ]);
        expect(document2.state).toBe(DocumentState.Validated);
        expect(document2.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);
    });

    test('runs missing validation checks if requested', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document1 = documentFactory.fromString(`
            foo 1 AnotherStrangeBar
            foo 11 B
            bar AnotherStrangeBar
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);

        const builder = services.shared.workspace.DocumentBuilder;
        await builder.build([document1], { validation: { categories: ['built-in', 'fast'] } });
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);

        await builder.build([document1], { validation: { categories: ['fast', 'slow'] } });
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11',
            'Bar is too long: AnotherStrangeBar'
        ]);

        // Re-running the fast checks should not lead to duplicate diagnostics
        await builder.build([document1], { validation: { categories: ['fast'] } });
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11',
            'Bar is too long: AnotherStrangeBar'
        ]);
    });

    test('reruns all validation checks if requested', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document1 = documentFactory.fromString(`
            foo 1 AnotherStrangeBar
            foo 11 B
            bar AnotherStrangeBar
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);

        const builder = services.shared.workspace.DocumentBuilder;
        await builder.build([document1], { validation: { categories: ['built-in', 'fast'] } });
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);

        await builder.build([document1], { validation: true });
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11',
            'Bar is too long: AnotherStrangeBar'
        ]);
    });

    test('waits until a specific workspace stage has been reached', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const builder = services.shared.workspace.DocumentBuilder;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const actual: string[] = [];
        function wait(state: DocumentState): void {
            builder.onBuildPhase(state, async () => {
                actual.push('B' + state);
            });
            builder.waitUntil(state).then(() => actual.push('W' + state));
        }
        // Register listeners for all possible document states
        // On each new state, there's supposed to be two new entries to the list
        for (let i = DocumentState.IndexedContent; i <= DocumentState.Validated; i++) {
            wait(i);
        }
        await builder.build([document], { validation: true });
        expect(actual).toEqual(['B2', 'W2', 'B3', 'W3', 'B4', 'W4', 'B5', 'W5', 'B6', 'W6']);
    });

    test('`waitUntil` will correctly wait even though the build process has been cancelled', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const builder = services.shared.workspace.DocumentBuilder;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const actual: string[] = [];
        const cancelTokenSource = new CancellationTokenSource();
        function wait(state: DocumentState): void {
            builder.onBuildPhase(state, async () => {
                actual.push('B' + state);
            });
        }
        for (let i = DocumentState.IndexedContent; i <= DocumentState.Validated; i++) {
            wait(i);
        }
        builder.waitUntil(DocumentState.ComputedScopes).then(() => cancelTokenSource.cancel());
        builder.waitUntil(DocumentState.IndexedReferences).then(() => {
            actual.push('W' + DocumentState.IndexedReferences);
        });
        // Build twice but interrupt the first build after the computing scope phase
        try {
            await builder.build([document], { validation: true }, cancelTokenSource.token);
            fail('The build is supposed to be cancelled');
        } catch {
            // build has been cancelled, ignore
        }
        document.state = DocumentState.Parsed;
        await builder.build([document], { validation: true });
        // The B2 and B3 phases are duplicated because the first build has been cancelled
        // W5 still appears as expected after B5
        expect(actual).toEqual(['B2', 'B3', 'B2', 'B3', 'B4', 'B5', 'W5', 'B6']);
    });

    test('`waitUntil` can be cancelled before it gets triggered', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const builder = services.shared.workspace.DocumentBuilder;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const cancelTokenSource = new CancellationTokenSource();
        builder.waitUntil(DocumentState.IndexedReferences, cancelTokenSource.token).then(() => {
            fail('The test should fail here because the cancellation should reject the promise');
        }).catch(err => {
            expect(isOperationCancelled(err)).toBeTruthy();
        });
        builder.onBuildPhase(DocumentState.ComputedScopes, () => {
            cancelTokenSource.cancel();
        });
        await builder.build([document], { validation: true });
    });

    test('`onDocumentPhase` always triggers before the respective `onBuildPhase`', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = services.shared.workspace.DocumentBuilder;

        const documentPhases = new Set<DocumentState>();

        for (let i = DocumentState.IndexedContent; i <= DocumentState.Validated; i++) {
            const phase = i;
            builder.onDocumentPhase(phase, () => {
                documentPhases.add(phase);
            });
            builder.onBuildPhase(phase, () => {
                expect(documentPhases.has(phase)).toBe(true);
            });
        }

        await builder.build([document], { validation: true });
        expect(document.state).toBe(DocumentState.Validated);
    });

    test('`onDocumentPhase` triggers during cancellation', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document1 = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = services.shared.workspace.DocumentBuilder;
        const tokenSource = new CancellationTokenSource();

        const buildPhases = new Set<DocumentState>();

        for (let i = DocumentState.IndexedContent; i <= DocumentState.Validated; i++) {
            const phase = i;
            builder.onDocumentPhase(phase, () => {
                if (phase === DocumentState.IndexedReferences) {
                    tokenSource.cancel();
                    // Wait a bit to ensure that the cancellation is processed
                    return new Promise(resolve => setTimeout(resolve, 20));
                }
                return Promise.resolve();
            });
            builder.onBuildPhase(phase, () => {
                buildPhases.add(phase);
            });
        }

        try {
            await builder.build([document1, document2], { validation: true }, tokenSource.token);
            fail('The build is supposed to be cancelled');
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        expect(document1.state).toBe(DocumentState.IndexedReferences);
        expect(document2.state).toBe(DocumentState.Linked);
        expect(buildPhases.has(DocumentState.IndexedReferences)).toBe(false);
    });

    test("References are unlinked on update even though the document didn't change", async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = workspace.DocumentBuilder;
        await builder.build([document], { validation: true });
        expect(document.state).toBe(DocumentState.Validated);
        expect(document.references).toHaveLength(2);

        workspace.TextDocuments.set(document.textDocument);
        try {
            // Immediately cancel the update to prevent the document from being rebuilt
            await builder.update([document.uri], [], CancellationToken.Cancelled);
            fail('The update is supposed to be cancelled');
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        expect(document.state).toBe(DocumentState.Changed);
        expect(document.references).toHaveLength(0);
        const astNodeReferences = AstUtils.streamAst(document.parseResult.value).flatMap(AstUtils.streamReferences).toArray();
        expect(astNodeReferences).toHaveLength(2);
        for (const ref of astNodeReferences) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const defaultRef = ref.reference as any;
            expect(defaultRef._ref).toBeUndefined();
        }
    });

    test("References are unlinked on update even if the document didn't reach linked phase yet", async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document = documentFactory.fromString(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const tokenSource = new CancellationTokenSource();
        const builder = workspace.DocumentBuilder;
        builder.onBuildPhase(DocumentState.ComputedScopes, () => {
            tokenSource.cancel();
        });
        try {
            await builder.build([document], undefined, tokenSource.token);
            fail('The update is supposed to be cancelled');
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        expect(document.state).toBe(DocumentState.ComputedScopes);
        expect(document.references).toHaveLength(0);

        // Resolve the reference "on-the-fly"
        // We would expect that doing so will add the reference to the document references
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const first = (document.parseResult.value as any).foos[0].bar.ref;
        expect(first).toBeDefined();
        expect(first.$type).toBe('Bar');

        expect(document.references).toHaveLength(1);

        workspace.TextDocuments.set(document.textDocument);
        try {
            // Immediately cancel the update to prevent the document from being rebuilt
            await builder.update([document.uri], [], CancellationToken.Cancelled);
            fail('The update is supposed to be cancelled');
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        expect(document.state).toBe(DocumentState.Changed);
        expect(document.references).toHaveLength(0);
        const astNodeReferences = AstUtils.streamAst(document.parseResult.value).flatMap(AstUtils.streamReferences).toArray();
        expect(astNodeReferences).toHaveLength(2);
        for (const ref of astNodeReferences) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const defaultRef = ref.reference as any;
            expect(defaultRef._ref).toBeUndefined();
        }
    });

    describe('DefaultDocumentBuilder document sorting', () => {
        let services: LangiumServices;
        let documentFactory: LangiumDocumentFactory;
        let documents: LangiumDocuments;
        let builder: DocumentBuilder;
        let textDocuments: TextDocuments<TextDocument>;
        let sortSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(async () => {
            services = await createServices(mockSharedModule);
            documentFactory = services.shared.workspace.LangiumDocumentFactory;
            documents = services.shared.workspace.LangiumDocuments;
            builder = services.shared.workspace.DocumentBuilder;
            textDocuments = services.shared.workspace.TextDocuments;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sortSpy = vi.spyOn(builder as any, 'sortDocuments');
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        async function createAndBuildDocuments(count: number): Promise<LangiumDocument[]> {
            const docs = Array.from({ length: count }, (_, i) => {
                const doc = documentFactory.fromString('', URI.parse(`file:///test${i}.txt`));
                documents.addDocument(doc);
                return doc;
            });
            await builder.build(docs, {});
            return docs;
        }

        async function openDocuments(docs: LangiumDocument[]): Promise<void> {
            docs.forEach(doc => textDocuments.set(doc.textDocument));
        }

        async function updateAndGetSortedDocuments(docs: LangiumDocument[]): Promise<LangiumDocument[]> {
            await builder.update(docs.map(d => d.uri), []);
            expect(sortSpy).toHaveBeenCalledTimes(1);
            return sortSpy.mock.results[0].value as LangiumDocument[];
        }

        function isDocumentOpen(doc: LangiumDocument): boolean {
            return Boolean(textDocuments.get(doc.uri));
        }

        test('Open documents are sorted before closed documents', async () => {
            const docs = await createAndBuildDocuments(4);
            await openDocuments([docs[1], docs[3]]);
            const sortedDocs = await updateAndGetSortedDocuments(docs);

            expect(sortedDocs.slice(0, 2).every(isDocumentOpen)).toBe(true);
            expect(sortedDocs.slice(2).every(doc => !isDocumentOpen(doc))).toBe(true);
        });

        test('All documents open - any order is acceptable', async () => {
            const docs = await createAndBuildDocuments(4);
            await openDocuments(docs);
            const sortedDocs = await updateAndGetSortedDocuments(docs);

            expect(sortedDocs).toHaveLength(docs.length);
            expect(sortedDocs.every(isDocumentOpen)).toBe(true);
        });

        test('All documents closed - any order is acceptable', async () => {
            const docs = await createAndBuildDocuments(4);
            const sortedDocs = await updateAndGetSortedDocuments(docs);

            expect(sortedDocs).toHaveLength(docs.length);
            expect(sortedDocs.every(doc => !isDocumentOpen(doc))).toBe(true);
        });

        test('Sorting maintains consistent open/closed document counts across multiple sorts', async () => {
            const docs = await createAndBuildDocuments(5);
            await openDocuments([docs[1], docs[3], docs[4]]);

            const firstSort = await updateAndGetSortedDocuments(docs);
            vi.clearAllMocks();
            const secondSort = await updateAndGetSortedDocuments(docs);

            const countOpenDocs = (sortedDocs: LangiumDocument[]) => sortedDocs.filter(isDocumentOpen).length;
            expect(countOpenDocs(firstSort)).toBe(3);
            expect(countOpenDocs(secondSort)).toBe(3);
            expect(firstSort.slice(0, 3).every(isDocumentOpen)).toBe(true);
            expect(secondSort.slice(0, 3).every(isDocumentOpen)).toBe(true);
        });

        test('Sorting a large number of documents', async () => {
            const documentCount = 10000;
            const openDocumentCount = Math.floor(documentCount / 3);

            const docs = await createAndBuildDocuments(documentCount);
            await openDocuments(docs.slice(0, openDocumentCount));

            const startTime = performance.now();
            const sortedDocs = await updateAndGetSortedDocuments(docs);
            const endTime = performance.now();

            expect(sortedDocs.slice(0, openDocumentCount).every(isDocumentOpen)).toBe(true);
            expect(sortedDocs.slice(openDocumentCount).every(doc => !isDocumentOpen(doc))).toBe(true);
            expect(endTime - startTime).toBeLessThan(1000); // Adjust this threshold as needed
        });

        test('Sorting an empty list of documents', async () => {
            const sortedDocs = await updateAndGetSortedDocuments([]);
            expect(sortedDocs).toEqual([]);
        });
    });
});

class MockFileSystemProvider implements FileSystemProvider {
    isMockFileSystemProvider = true;

    // Return an empty string for any file
    readFile(_uri: URI): Promise<string>{
        return Promise.resolve('');
    }

    // Return an empty array for any directory
    readDirectory(_uri: URI): Promise<[]> {
        return Promise.resolve([]);
    }
}

export const mockSharedModule: Module<LangiumSharedServices, object> = {
    workspace: {
        FileSystemProvider: () => new MockFileSystemProvider()
    }
};

type TestAstType = {
    Model: Model
    Foo: Foo
    Bar: Bar
}

interface Model extends AstNode {
    foos: Foo[]
}

interface Foo extends AstNode {
    value: number
    bar: Reference<Bar>
}

interface Bar extends AstNode {
    name: string
}
