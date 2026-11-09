/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { SDiagnosticMarker } from 'langium-sprotty';
import { addHoverPopupHandler, SprottyDefaultModule, SprottySharedModule } from 'langium-sprotty';
import { createServicesForGrammar } from 'langium/grammar';
import type { Action, DiagramServer, DiagramState, HtmlRoot, PreRenderedElement, RequestPopupModelAction, SetPopupModelAction } from 'sprotty-protocol';
import { describe, expect, test } from 'vitest';

describe('addHoverPopupHandler', async () => {
    const grammar = `
        grammar Test
        entry Root: name=ID;
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `;
    const services = await createServicesForGrammar({
        grammar,
        module: SprottyDefaultModule,
        sharedModule: SprottySharedModule
    });
    addHoverPopupHandler(services);

    async function requestPopupCode(marker: SDiagnosticMarker): Promise<string> {
        const state: DiagramState = {
            currentRoot: { type: 'graph', id: 'root', children: [marker] },
            revision: 0
        };
        const dispatched: Action[] = [];
        const server: DiagramServer = { dispatch: async (action: Action) => { dispatched.push(action); } } as DiagramServer;
        const request: RequestPopupModelAction = {
            kind: 'requestPopupModel',
            requestId: 'popup',
            elementId: marker.id,
            bounds: { x: 0, y: 0, width: 0, height: 0 }
        };
        for (const handler of services.diagram.ServerActionHandlerRegistry.getHandler(request.kind) ?? []) {
            await handler(request, state, server);
        }
        expect(dispatched).toHaveLength(1);
        const root: HtmlRoot = (dispatched[0] as SetPopupModelAction).newRoot;
        return (root.children?.[0] as PreRenderedElement).code;
    }

    test('escapes markup in diagnostic messages', async () => {
        const code = await requestPopupCode({
            type: 'marker',
            id: 'marker',
            issues: [{
                severity: 'error',
                message: 'Could not resolve reference to A named \'<img src=x onerror="alert(1)">\'.'
            }]
        });
        expect(code).not.toContain('<img');
        expect(code).toContain('named &#39;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;.');
    });

    test('escapes markup in severity class names', async () => {
        const code = await requestPopupCode({
            type: 'marker',
            id: 'marker',
            issues: [{
                severity: 'error" onmouseover="alert(1)' as 'error',
                message: 'm'
            }]
        });
        expect(code).toContain('class="sprotty-error&quot; onmouseover=&quot;alert(1)"');
    });

    test('does not separate multiple issues with commas', async () => {
        const code = await requestPopupCode({
            type: 'marker',
            id: 'marker',
            issues: [
                { severity: 'error', message: 'first' },
                { severity: 'warning', message: 'second' }
            ]
        });
        expect(code).toContain('<span class="sprotty-error">first</span>');
        expect(code).toContain('<span class="sprotty-warning">second</span>');
        expect(code).not.toMatch(/<\/div>\s*,/);
    });

});
