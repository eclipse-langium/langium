/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import type { TracedModelElement } from 'langium-sprotty';
import type { SModelRoot } from 'sprotty-protocol';
import { beforeEach, describe, expect, test } from 'vitest';
import { createServicesForGrammar } from 'langium/grammar';
import { clearDocuments, parseHelper } from 'langium/test';
import { SprottyDefaultModule, SprottySharedModule } from 'langium-sprotty';

describe('DefaultTraceProvider', async () => {
    const grammar = `
        grammar Test
        entry Root:
            nodes+=Node*;
        Node:
            'node' name=ID '{' nodes+=Node* '}';
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `;
    const services = await createServicesForGrammar({
        grammar,
        module: SprottyDefaultModule,
        sharedModule: SprottySharedModule
    });
    const parser = parseHelper<Root>(services);

    beforeEach(() => {
        clearDocuments(services);
    });

    test('computes correct trace', async () => {
        const document = await parser(`
            node a {
                node b {}
            }
        `, { documentUri: 'test://test.model' });
        const model = document.parseResult.value;
        const source = model.nodes[0].nodes[0];
        expect(source).toBeDefined();
        const target: TracedModelElement = {
            type: 'node',
            id: 'node0'
        };
        services.diagram.TraceProvider.trace(target, source);
        expect(target.trace).toBe('test://test.model?2%3A16-2%3A25#%2Fnodes%400%2Fnodes%400');
    });

    test('finds source node', async () => {
        const document = await parser(`
            node a {
                node b {}
            }
        `, { documentUri: 'test://test.model' });
        const model = document.parseResult.value;
        const target: TracedModelElement = {
            type: 'node',
            id: 'node0',
            trace: 'test://test.model?2%3A16-2%3A25#%2Fnodes%400%2Fnodes%400'
        };
        const source = services.diagram.TraceProvider.getSource(target);
        expect(source).toBeDefined();
        expect(source).toStrictEqual(model.nodes[0].nodes[0]);
    });

    test('finds target element', async () => {
        const document = await parser(`
            node a {
                node b {}
            }
        `, { documentUri: 'test://test.model' });
        const model = document.parseResult.value;
        const source = model.nodes[0].nodes[0];
        expect(source).toBeDefined();
        const root: SModelRoot = {
            type: 'root',
            id: 'root',
            children: [
                {
                    type: 'node',
                    id: 'node0'
                },
                <TracedModelElement>{
                    type: 'node',
                    id: 'node1',
                    trace: 'test://test.model?2%3A16-2%3A25#%2Fnodes%400%2Fnodes%400'
                }
            ]
        };
        const target = services.diagram.TraceProvider.getTarget(source, root);
        expect(target).toBeDefined();
        expect(target).toStrictEqual(root.children![1]);
    });

    test('finds container of target element', async () => {
        const document = await parser(`
            node a {
                node b {}
            }
        `, { documentUri: 'test://test.model' });
        const model = document.parseResult.value;
        const source = model.nodes[0].nodes[0];
        expect(source).toBeDefined();
        const root: SModelRoot = {
            type: 'root',
            id: 'root',
            children: [
                {
                    type: 'node',
                    id: 'node0'
                },
                <TracedModelElement>{
                    type: 'node',
                    id: 'node0',
                    trace: 'test://test.model?1%3A12-3%3A13#%2Fnodes%400'
                }
            ]
        };
        const target = services.diagram.TraceProvider.getTarget(source, root);
        expect(target).toBeDefined();
        expect(target).toStrictEqual(root.children![1]);
    });

    test('finds closest target element among candidates', async () => {
        const document = await parser(`
            node a {
                node b {}
            }
        `, { documentUri: 'test://test.model' });
        const model = document.parseResult.value;
        const source = model.nodes[0].nodes[0];
        expect(source).toBeDefined();
        const root: SModelRoot = {
            type: 'root',
            id: 'root',
            children: [
                <TracedModelElement>{
                    type: 'node',
                    id: 'node0',
                    trace: 'test://test.model?1%3A12-3%3A13#%2Fnodes%400'
                },
                <TracedModelElement>{
                    type: 'node',
                    id: 'node1',
                    trace: 'test://test.model?2%3A16-2%3A25#%2Fnodes%400%2Fnodes%400'
                }
            ]
        };
        const target = services.diagram.TraceProvider.getTarget(source, root);
        expect(target).toBeDefined();
        expect(target).toStrictEqual(root.children![1]);
    });

});

interface Root extends AstNode {
    nodes: Node[]
}

interface Node extends AstNode {
    name: string
    nodes: Node[]
}
