/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { fail } from 'assert';
import type { AstNode, BuildOptions, DocumentBuilder, FileSystemNode, FileSystemProvider, LangiumDocument, LangiumDocumentFactory, LangiumDocuments, Module, Reference, ValidationChecks } from 'langium';
import { AstUtils, DefaultDocumentBuilder, DocumentState, isOperationCancelled, startCancelableOperation, TextDocument, URI, UriUtils } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import type { LangiumServices, LangiumSharedServices, PartialLangiumSharedServices, TextDocuments } from 'langium/lsp';
import { VirtualFileSystemProvider } from 'langium/test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CancellationToken } from 'vscode-languageserver';

describe('DefaultDocumentBuilder', () => {
    async function createServices(shared?: Module<LangiumSharedServices, PartialLangiumSharedServices>) {
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
        const document = documentFactory.fromString<Model>('', URI.parse('file:///test1.txt'));
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
        const document = documentFactory.fromString<Model>('', URI.parse('file:///test1.txt'));
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

    test('emits `onUpdate` on `update` call in a directory', async () => {
        const virtualFileSystem = new VirtualFileSystemProvider();
        const services = await createServices({
            workspace: {
                FileSystemProvider: () => virtualFileSystem
            }
        });
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const uri1 = URI.parse('file:/dir1/test.txt');
        const uri2 = URI.parse('file:/dir2/test.txt');
        virtualFileSystem.insert(uri1, '');
        virtualFileSystem.insert(uri2, '');
        const document1 = await documentFactory.fromUri(uri1);
        documents.addDocument(document1);
        const document2 = await documentFactory.fromUri(uri2);
        documents.addDocument(document2);

        const builder = workspace.DocumentBuilder;
        await builder.build([document1, document2], {});
        let deleted = false;
        let updated = false;
        builder.onUpdate((changedUris, deletedUris) => {
            if (UriUtils.equals(changedUris[0], uri1)) {
                updated = true;
            }
            if (UriUtils.equals(deletedUris[0], uri2)) {
                deleted = true;
            }
        });
        await builder.update([URI.parse('file:/dir1')], [URI.parse('file:/dir2')]);
        expect(deleted).toBe(true);
        expect(updated).toBe(true);
    });

    test('Check all onBuidPhase callbacks', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString<Model>(`
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
        const document1 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString<Model>(`
            foo 1 C
            foo 11 D
            bar C
            bar D
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = workspace.DocumentBuilder;
        const tokenSource1 = startCancelableOperation();
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
        const document1 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString<Model>(`
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
        const document1 = documentFactory.fromString<Model>(`
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
        const document1 = documentFactory.fromString<Model>(`
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
            'Bar is too long: AnotherStrangeBar',
            'Value is too large: 11',
        ]);
    });

    test('Dont validate completed documents again, if the validation phase is cancelled', async () => {
        class TestDocumentBuilder extends DefaultDocumentBuilder {
            isCompleted(doc: LangiumDocument): boolean {
                return this.buildState.get(doc.uri.toString())?.completed ?? false;
            }
        }
        const services = await createServices({
            workspace: {
                DocumentBuilder: services => new TestDocumentBuilder(services),
            },
        });
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document1 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString<Model>(`
            foo 1 C
            foo 11 D
            bar C
            bar D
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);
        const builder = workspace.DocumentBuilder as TestDocumentBuilder;

        // While the first document is completed, the second one misses the validation phase.
        const token = startCancelableOperation();
        builder.onDocumentPhase(DocumentState.Validated, doc => {
            if (doc === document1) {
                token.cancel(); // cancel the build after validating the 1st and before the 2nd document
            }
        });
        try {
            await builder.build([document1, document2], { validation: true }, token.token);
        } catch (err) {
            expect(isOperationCancelled(err)).toBe(true);
        }
        expect(builder.isCompleted(document1)).toBe(true);
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);
        expect(builder.isCompleted(document2)).toBe(false);
        expect(document2.state).toBe(DocumentState.IndexedReferences);
        expect(document2.diagnostics).toBeUndefined();

        // Check that only the validation of the second document is executed when continuing the build.
        workspace.TextDocuments.set(document1.textDocument);
        workspace.TextDocuments.set(document2.textDocument);
        builder.onDocumentPhase(DocumentState.Validated, doc => {
            if (doc === document1) {
                expect.fail(`Don't validate the completed document ${doc.uri.toString()} again!`);
            }
        });
        await builder.update([], []);
        expect(builder.isCompleted(document1)).toBe(true);
        expect(document1.state).toBe(DocumentState.Validated);
        expect(document1.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);
        expect(builder.isCompleted(document2)).toBe(true);
        expect(document2.state).toBe(DocumentState.Validated);
        expect(document2.diagnostics?.map(d => d.message)).toEqual([
            'Value is too large: 11'
        ]);
    });

    test('skips linking if eagerLinking is false', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = services.shared.workspace.DocumentBuilder;
        await builder.build([document], { eagerLinking: false });
        expect(document.state).toBe(DocumentState.ComputedScopes);
        // References should not be linked when eagerLinking is false
        expect(document.references).toHaveLength(0);
        // But we can still resolve references on demand
        const firstFoo = document.parseResult.value.foos[0];
        expect(firstFoo.bar.ref).toBeDefined();
        expect(firstFoo.bar.ref!.$type).toBe('Bar');
        expect(firstFoo.bar.ref!.name).toBe('A');
    });

    test('can handle multiple listeners (buildPhase)', async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const uri = URI.parse('file:///test1.txt');
        const document1 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, uri);
        documents.addDocument(document1);

        const builder = workspace.DocumentBuilder;
        const p1 = builder.waitUntil(DocumentState.IndexedReferences, uri).then(() => {
        });
        const p2 = builder.waitUntil(DocumentState.IndexedReferences, uri).then(() => {
        });
        await builder.build([document1], {});
        await Promise.all([p1, p2]);
        expect(document1.state).toBe(DocumentState.IndexedReferences);
    });

    test('can handle multiple listeners (documentPhase)', async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const uri = URI.parse('file:///test1.txt');
        const document1 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, uri);
        documents.addDocument(document1);

        const builder = workspace.DocumentBuilder;
        let p1called = false;
        const p1 = builder.onDocumentPhase(DocumentState.IndexedReferences, (_d) => {
            p1called = true;
            p1.dispose();
        });
        let p2called = false;
        const p2 = builder.onDocumentPhase(DocumentState.IndexedReferences, (_d) => {
            p2called = true;
            p2.dispose();
        });
        await builder.build([document1], {});
        expect(p1called).toBe(true);
        expect(p2called).toBe(true);
    });

    test('waits until a specific workspace stage has been reached', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const builder = services.shared.workspace.DocumentBuilder;
        const document = documentFactory.fromString<Model>('', URI.parse('file:///test1.txt'));
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
        const document = documentFactory.fromString<Model>('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const actual: string[] = [];
        const cancelTokenSource = startCancelableOperation();
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
        const document = documentFactory.fromString<Model>('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const cancelTokenSource = startCancelableOperation();
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

    test('`waitUntil` will correctly resolve if the document is already in the target state.', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const builder = services.shared.workspace.DocumentBuilder;
        const documentUri = URI.parse('file:///test1.txt');
        const document = documentFactory.fromString<Model>('', documentUri);
        documents.addDocument(document);
        await builder.build([document], { validation: true });
        expect(document.state).toBe(DocumentState.Validated);
        // Should instantly resolve, since the document is already validated.
        await expect(
            Promise.race([
                builder.waitUntil(DocumentState.Validated, documentUri),
                new Promise((_, rej) => setTimeout(rej))
            ])
        ).resolves.toEqual(documentUri);
    });

    test('`waitUntil` on document fires as soon as document reaches required state.', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const builder = services.shared.workspace.DocumentBuilder;

        const document = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);
        const document2 = documentFactory.fromString<Model>('', URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const states: DocumentState[] = [];
        builder.waitUntil(DocumentState.Linked, document.uri).then(() => {
            states.push(document.state, document2.state);
        });

        await builder.build(documents.all.toArray());
        expect(states).toEqual([ DocumentState.Linked, DocumentState.ComputedScopes ]);
    });

    test('`onDocumentPhase` always triggers before the respective `onBuildPhase`', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString<Model>(`
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
        const document1 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document1);
        const document2 = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = services.shared.workspace.DocumentBuilder;
        const tokenSource = startCancelableOperation();

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
        const document = documentFactory.fromString<Model>(`
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
        const document = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const tokenSource = startCancelableOperation();
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
        const first = document.parseResult.value.foos[0].bar.ref;
        expect(first).toBeDefined();
        expect(first!.$type).toBe('Bar');

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

    test("References are unlinked on custom reset of document state even if the document didn't reach linked phase yet", async () => {
        const services = await createServices();
        const workspace = services.shared.workspace;
        const documentFactory = workspace.LangiumDocumentFactory;
        const documents = workspace.LangiumDocuments;
        const document = documentFactory.fromString<Model>(`
            foo 1 A
            foo 11 B
            bar A
            bar B
        `, URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const tokenSource = startCancelableOperation();
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
        expect(document.localSymbols).toBeDefined();
        expect(document.references).toHaveLength(0);

        // Resolve the reference "on-the-fly"
        // We would expect that doing so will add the reference to the document references
        let first = document.parseResult.value.foos[0].bar.ref;
        expect(first).toBeDefined();
        expect(first!.$type).toBe('Bar');
        expect(document.references).toHaveLength(1);

        // Primary testing goal: Reset the document state and clean references in order to get rid of any stale ones;
        // here resetting to IndexedContent in order to also clear any pre-computed scopes/local symbol tables
        builder.resetToState(document, DocumentState.IndexedContent);

        expect(document.state).toBe(DocumentState.IndexedContent);
        expect(document.localSymbols).toBeUndefined();
        expect(document.references).toHaveLength(0);

        // Again, resolve the reference "on-the-fly", this is supposed to work as 'A' is accessible via the index
        first = document.parseResult.value.foos[0].bar.ref;
        expect(first).toBeDefined();
        expect(first!.$type).toBe('Bar');
        expect(document.references).toHaveLength(1);

        // In addition: Alternatively, attempt to reset the document state to ComputedScopes
        builder.resetToState(document, DocumentState.ComputedScopes);

        expect(document.state).toBe(DocumentState.IndexedContent);
        expect(document.references).toHaveLength(0);

        const astNodeReferences = AstUtils.streamAst(document.parseResult.value).flatMap(AstUtils.streamReferences).toArray();
        expect(astNodeReferences).toHaveLength(2);
        for (const ref of astNodeReferences) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const defaultRef = ref.reference as any;
            expect(defaultRef._ref).toBeUndefined();
        }
    });

    describe('Updates', () => {
        let services: LangiumServices;
        let documentFactory: LangiumDocumentFactory;
        let documents: LangiumDocuments;
        let builder: TestDocumentBuilder;
        let textDocuments: TextDocuments<TextDocument>;

        let documentA: LangiumDocument<Model>;
        let documentB: LangiumDocument<Model>;

        class TestDocumentBuilder extends DefaultDocumentBuilder {
            resetted: string[] = [];
            actuallyBuilt: string[] = [];
            checkBeforeBuild?: () => void;

            override build<T extends AstNode>(documents: Array<LangiumDocument<T>>, options?: BuildOptions, cancelToken?: CancellationToken): Promise<void> {
                this.resetted.splice(0, this.resetted.length);
                this.actuallyBuilt.splice(0, this.actuallyBuilt.length);
                return super.build(documents, options, cancelToken);
            }
            override update(changed: URI[], deleted: URI[], cancelToken?: CancellationToken): Promise<void> {
                this.resetted.splice(0, this.resetted.length);
                this.actuallyBuilt.splice(0, this.actuallyBuilt.length);
                return super.update(changed, deleted, cancelToken);
            }

            protected override buildDocuments(documents: LangiumDocument[], options: BuildOptions, cancelToken: CancellationToken): Promise<void> {
                this.actuallyBuilt.push(...documents.map(d => d.uri.path));
                if (this.checkBeforeBuild) {
                    this.checkBeforeBuild();
                }
                return super.buildDocuments(documents, options, cancelToken);
            }
            override resetToState<T extends AstNode>(document: LangiumDocument<T>, state: DocumentState): void {
                this.resetted.push(`${document.uri.path}: ${DocumentState[state]}`);
                return super.resetToState(document, state);
            }
        }

        beforeEach(async () => {
            services = await createServices({
                workspace: {
                    DocumentBuilder: services => new TestDocumentBuilder(services),
                },
            });
            documentFactory = services.shared.workspace.LangiumDocumentFactory;
            documents = services.shared.workspace.LangiumDocuments;
            builder = services.shared.workspace.DocumentBuilder as TestDocumentBuilder;
            textDocuments = services.shared.workspace.TextDocuments;

            // set-up for the documents
            documentA = documentFactory.fromString<Model>(`
                foo 1 A
                foo 11 B
            `, URI.parse('file:///testA.txt'));
            documentB = documentFactory.fromString<Model>(`
                bar A
                bar B
            `, URI.parse('file:///testB.txt'));
            documents.addDocument(documentA);
            documents.addDocument(documentB);

            expect(builder.resetted).toHaveLength(0);

            // initial build of all documents
            await builder.build([documentA, documentB], { eagerLinking: true, validation: { categories: ['built-in', 'fast'] } });
            checkDocumentStateAfterBuild();
            // resetToState is not called during the initial build
            expect(builder.resetted).toHaveLength(0);
            expect(builder.actuallyBuilt).toHaveLength(2);
            expect(builder.actuallyBuilt[0]).toBe('/testA.txt');
            expect(builder.actuallyBuilt[1]).toBe('/testB.txt');

            // preparation for following update scenarios
            textDocuments.set(documentA.textDocument);
            textDocuments.set(documentB.textDocument);
        });

        function checkDocumentStateAfterBuild(): void {
            expect(documentA.state).toBe(DocumentState.Validated);
            expect(documentB.state).toBe(DocumentState.Validated);
            expect(documentA.references).toHaveLength(2);
            expect(documentB.references).toHaveLength(0);
        }

        test('Update A => resetToState is called for A', async () => {
            builder.checkBeforeBuild = () => {
                expect(documentA.references).toHaveLength(0);
                expect(documentA.localSymbols).toBe(undefined);
                expect(documentA.diagnostics).toBe(undefined);
                expect(documentB.localSymbols).not.toBe(undefined);
                expect(documentB.diagnostics).not.toBe(undefined);
            };
            await builder.update([documentA.uri], []);
            checkDocumentStateAfterBuild();

            expect(builder.resetted).toHaveLength(1);
            expect(builder.resetted[0]).toBe('/testA.txt: Changed');
            expect(builder.actuallyBuilt).toHaveLength(1);
            expect(builder.actuallyBuilt[0]).toBe('/testA.txt');
        });

        test('Update B => resetToState is called for A and B (since A links to B)', async () => {
            builder.checkBeforeBuild = () => {
                expect(documentA.references).toHaveLength(0);
                expect(documentA.localSymbols).not.toBe(undefined);
                expect(documentA.diagnostics).toBe(undefined);
                expect(documentB.localSymbols).toBe(undefined);
                expect(documentB.diagnostics).toBe(undefined);
            };
            await builder.update([documentB.uri], []);
            checkDocumentStateAfterBuild();

            expect(builder.resetted).toHaveLength(2);
            expect(builder.resetted[0]).toBe('/testB.txt: Changed');
            expect(builder.resetted[1]).toBe('/testA.txt: ComputedScopes');
            expect(builder.actuallyBuilt).toHaveLength(2);
            expect(builder.actuallyBuilt[0]).toBe('/testA.txt');
            expect(builder.actuallyBuilt[1]).toBe('/testB.txt');
        });

        test('Call resetToState(ComputedScopes) explicitly for B, update A => resetToState is called for A, now A and B should be built', async () => {
            expect(documentB.state).toBe(DocumentState.Validated);
            expect(builder.resetted).toHaveLength(0);

            // resetToState for B => build B again
            //  (Motivation for `resetToState`: Explicitly test `resetToState`, which enables to control the desired starting phase for updates in fine-grain way)
            builder.resetToState(documentB, DocumentState.ComputedScopes);

            expect(documentB.state).toBe(DocumentState.ComputedScopes);
            expect(builder.resetted).toHaveLength(1);
            expect(builder.resetted[0]).toBe('/testB.txt: ComputedScopes');

            // update A
            builder.checkBeforeBuild = () => {
                expect(documentA.references).toHaveLength(0);
                expect(documentA.localSymbols).toBe(undefined);
                expect(documentA.diagnostics).toBe(undefined);
                expect(documentB.localSymbols).not.toBe(undefined);
                expect(documentB.diagnostics).toBe(undefined);
            };
            await builder.update([documentA.uri], []);
            checkDocumentStateAfterBuild();

            expect(builder.resetted).toHaveLength(1);
            expect(builder.resetted[0]).toBe('/testA.txt: Changed');
            expect(builder.actuallyBuilt).toHaveLength(2);
            expect(builder.actuallyBuilt[0]).toBe('/testA.txt');
            expect(builder.actuallyBuilt[1]).toBe('/testB.txt');
        });

        test('Call resetToState(IndexedReferences) explicitly for B, update A => resetToState is called for A, now A and B should be built', async () => {
            expect(documentB.state).toBe(DocumentState.Validated);
            expect(builder.resetted).toHaveLength(0);

            // resetToState for B => build B again
            //  (Motivation for `resetToState`: Explicitly test `resetToState`, which enables to control the desired starting phase for updates in fine-grain way)
            builder.resetToState(documentB, DocumentState.IndexedReferences);

            expect(documentB.state).toBe(DocumentState.IndexedReferences);
            expect(builder.resetted).toHaveLength(1);
            expect(builder.resetted[0]).toBe('/testB.txt: IndexedReferences');

            // update A
            builder.checkBeforeBuild = () => {
                expect(documentA.references).toHaveLength(0);
                expect(documentA.localSymbols).toBe(undefined);
                expect(documentA.diagnostics).toBe(undefined);
                expect(documentB.localSymbols).not.toBe(undefined);
                expect(documentB.diagnostics).toBe(undefined);
            };
            await builder.update([documentA.uri], []);
            checkDocumentStateAfterBuild();

            expect(builder.resetted).toHaveLength(1);
            expect(builder.resetted[0]).toBe('/testA.txt: Changed');
            expect(builder.actuallyBuilt).toHaveLength(2);
            expect(builder.actuallyBuilt[0]).toBe('/testA.txt');
            expect(builder.actuallyBuilt[1]).toBe('/testB.txt');
        });

        test('During updates, validate only some categories: dont validate already executed category', async () => {
            // validate only 'built-in' checks now
            builder.updateBuildOptions = { validation: { categories: ['built-in'] } };
            await builder.update([], []);
            checkDocumentStateAfterBuild();
            // => no documents are validated again with 'built-in' checks, since 'built-in' (and 'fast') checks are already executed during the initial build
            expect(builder.resetted).toHaveLength(0);
            expect(builder.actuallyBuilt).toHaveLength(0);
        });

        test('During updates, validate only some categories: validate not yet executed category', async () => {
            // validate only 'slow' checks now
            builder.updateBuildOptions = { validation: { categories: ['slow'] } };
            await builder.update([], []);
            checkDocumentStateAfterBuild();
            // => all documents are validated again with 'slow' checks, since only 'built-in' and 'fast' checks are executed during the initial build
            expect(builder.resetted).toHaveLength(0);
            expect(builder.actuallyBuilt).toHaveLength(2);
            expect(builder.actuallyBuilt[0]).toBe('/testA.txt');
            expect(builder.actuallyBuilt[1]).toBe('/testB.txt');
        });

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
            expect(endTime - startTime).toBeLessThan(1800); // Adjust this threshold as needed
        });

        test('Sorting an empty list of documents', async () => {
            const sortedDocs = await updateAndGetSortedDocuments([]);
            expect(sortedDocs).toEqual([]);
        });
    });
});

class MockFileSystemProvider implements FileSystemProvider {
    isMockFileSystemProvider = true;

    async stat(uri: URI): Promise<FileSystemNode> {
        return {
            isDirectory: false,
            isFile: true,
            uri
        };
    }

    statSync(uri: URI): FileSystemNode {
        return {
            isDirectory: false,
            isFile: true,
            uri
        };
    }

    // Return an empty string for any file
    readFile(_uri: URI): Promise<string>{
        return Promise.resolve('');
    }

    async exists(_uri: URI): Promise<boolean> {
        return false;
    }
    existsSync(): boolean {
        return false;
    }
    async readBinary(_uri: URI): Promise<Uint8Array> {
        return new Uint8Array();
    }
    readBinarySync(_uri: URI): Uint8Array {
        return new Uint8Array();
    }
    readFileSync(_uri: URI): string {
        return '';
    }
    readDirectorySync(_uri: URI): FileSystemNode[] {
        return [];
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
    bars: Bar[]
}

interface Foo extends AstNode {
    value: number
    bar: Reference<Bar>
}

interface Bar extends AstNode {
    name: string
}
