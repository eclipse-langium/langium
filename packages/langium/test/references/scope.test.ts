/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { MapScope } from '../../src/references/scope.js';
import type { AstNodeDescription } from '../../src/syntax-tree.js';

describe('Tests the default map scope implementation', () => {
    const description: AstNodeDescription = {
        name: 'MyName',
        type: 'Type1',
        documentUri: undefined!,
        path: undefined!,
    };

    test('Do not use a given outer scope, if using the outer scope is disabled by option', async () => {
        const outerScope = new MapScope([description]);
        // the outer scope is given, but deactivated by the option
        const innerScope = new MapScope([description], outerScope, { concatOuterScope: false });
        const items = innerScope.getElements('MyName').toArray();
        // we expect only a single description from the inner scope
        expect(items).toHaveLength(1);
    });

    test('Outer scope is used, when requested', async () => {
        const outerScope = new MapScope([description]);
        const innerScope = new MapScope([description], outerScope, { concatOuterScope: true });
        const items = innerScope.getElements('MyName').toArray();
        expect(items).toHaveLength(2);
    });

    test('Outer scope is used, when inner scope is empty', async () => {
        const outerScope = new MapScope([description]);
        const innerScope = new MapScope([/* empty! */], outerScope, { concatOuterScope: false });
        const items = innerScope.getElements('MyName').toArray();
        expect(items).toHaveLength(1);
    });

    test('Outer scope is used, when requested and inner scope is empty', async () => {
        const outerScope = new MapScope([description]);
        const innerScope = new MapScope([/* empty! */], outerScope, { concatOuterScope: true });
        const items = innerScope.getElements('MyName').toArray();
        expect(items).toHaveLength(1);
    });

});
