/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { expandToString } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper, replaceIndices } from 'langium/test';
import { describe, expect, test } from 'vitest';

describe('LangiumGrammarCallHierarchyProvider', () => {
    test('uses the declaration URI for a cross-file reference', async () => {
        const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const parse = parseHelper(services);
        const base = await parse("BaseRule: name='base';", { documentUri: 'file:///base.langium' });
        const { output, indices } = replaceIndices({ text: expandToString`
            grammar Use
            import './base'
            entry Main: calls+=<|>BaseRule*;
        ` });
        const use = await parse(output, { documentUri: 'file:///use.langium' });
        const provider = services.lsp.CallHierarchyProvider!;
        const items = await provider.prepareCallHierarchy(use, {
            textDocument: { uri: use.uri.toString() },
            position: use.textDocument.positionAt(indices[0])
        });
        expect(items).toMatchObject([{ name: 'BaseRule', uri: base.uri.toString() }]);
        const incoming = await provider.incomingCalls({ item: items![0] });
        expect(incoming).toMatchObject([{ from: { name: 'Main', uri: use.uri.toString() } }]);
    });
});
