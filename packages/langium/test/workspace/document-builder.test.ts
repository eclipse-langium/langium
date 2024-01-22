/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Reference, ValidationChecks } from 'langium';
import { DocumentState, TextDocument, URI, isOperationCancelled } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { setTextDocument } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { CancellationTokenSource } from 'vscode-languageserver';
import { fail } from 'assert';

describe('DefaultDocumentBuilder', () => {
    async function createServices() {
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
        const services = await createServicesForGrammar({ grammar });
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
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = services.shared.workspace.DocumentBuilder;
        await builder.build([document], {});
        setTextDocument(services, document.textDocument);
        let called = false;
        builder.onUpdate(() => {
            called = true;
        });
        await builder.update([document.uri], []);
        expect(called).toBe(true);
    });

    test('emits `onUpdate` on `build` call', async () => {
        const services = await createServices();
        const documentFactory = services.shared.workspace.LangiumDocumentFactory;
        const documents = services.shared.workspace.LangiumDocuments;
        const document = documentFactory.fromString('', URI.parse('file:///test1.txt'));
        documents.addDocument(document);

        const builder = services.shared.workspace.DocumentBuilder;
        await builder.build([document], {});
        setTextDocument(services, document.textDocument);
        let called = false;
        builder.onUpdate(() => {
            called = true;
        });
        await builder.build([document]);
        expect(called).toBe(true);
    });

    test('resumes document build after cancellation', async () => {
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
            foo 1 C
            foo 11 D
            bar C
            bar D
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = services.shared.workspace.DocumentBuilder;
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

        setTextDocument(services, document1.textDocument);
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
            foo 1 C
            foo 11 A
            bar C
        `, URI.parse('file:///test2.txt'));
        documents.addDocument(document2);

        const builder = services.shared.workspace.DocumentBuilder;
        await builder.build([document1, document2], {});
        expect(document1.state).toBe(DocumentState.IndexedReferences);
        expect(document1.references.filter(r => r.error !== undefined)).toHaveLength(0);
        expect(document2.state).toBe(DocumentState.IndexedReferences);
        expect(document2.references.filter(r => r.error !== undefined)).toHaveLength(0);

        setTextDocument(services, document1.textDocument);
        TextDocument.update(document1.textDocument, [{
            // Change `foo 1 A` to `foo 1 D`, breaking the local reference
            range: { start: { line: 1, character: 18 }, end: { line: 1, character: 19 } },
            text: 'D'
        }], 1);
        setTextDocument(services, document2.textDocument);
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

});

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
