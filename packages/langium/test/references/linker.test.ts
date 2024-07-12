/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultScopeProvider, type AstNode, type LangiumCoreServices, type Module, type PartialLangiumCoreServices, type Reference, type ReferenceInfo, type Scope } from 'langium';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createServicesForGrammar } from 'langium/grammar';
import { clearDocuments, parseHelper } from 'langium/test';

describe('DefaultLinker', async () => {
    const grammar = `
        grammar Test
        entry Root:
            nodes+=Node* referrers+=Referrer*;
        Node:
            'node' name=ID;
        Referrer:
            'referrer' node=[Node];
        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
    `;
    const cyclicModule: Module<LangiumCoreServices, PartialLangiumCoreServices> = {
        references: {
            ScopeProvider: (services) => new BrokenScopeProvider(services)
        }
    };
    const cyclicServices = await createServicesForGrammar({
        grammar,
        module: cyclicModule
    });
    const cyclicParser = parseHelper<Root>(cyclicServices);

    let errorLog: typeof console.error;
    beforeEach(() => {
        clearDocuments(cyclicServices);
        errorLog = console.error;
        console.error = () => {};
    });
    afterEach(() => {
        console.error = errorLog;
    });

    test('throws an error upon cyclic resolution', async () => {
        const document = await cyclicParser(`
            node a
            referrer a
        `, { documentUri: 'test://test.model' });
        const model = document.parseResult.value;
        expect(model.referrers[0]?.node?.error).toBeDefined();
        expect(model.referrers[0].node.error?.message).toBe(
            "An error occurred while resolving reference to 'a': Cyclic reference resolution detected: /referrers@0/node (symbol 'a')");
    });

});

interface Root extends AstNode {
    nodes: Node[]
    referrers: Referrer[]
}

interface Node extends AstNode {
    name: string
}

interface Referrer extends AstNode {
    node: Reference<Node>
}

class BrokenScopeProvider extends DefaultScopeProvider {
    override getScope(context: ReferenceInfo): Scope {
        if (context.container.$type === 'Referrer' && context.property === 'node') {
            const referrer = context.container as Referrer;
            // FORBIDDEN: access the reference that we're trying to find a scope for
            referrer.node.ref;
        }
        return super.getScope(context);
    }
}
