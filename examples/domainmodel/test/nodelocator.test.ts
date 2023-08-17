/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import type { Domainmodel, PackageDeclaration } from '../src/language-server/generated/ast.js';
import { describe, expect, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { parseDocument } from 'langium/test';
import { createDomainModelServices } from '../src/language-server/domain-model-module.js';

const services = createDomainModelServices(EmptyFileSystem).domainmodel;

const datatypeFile = `
datatype Int
datatype Decimal

package big {
    datatype Int
    datatype Decimal
}
 `;

describe('AstNode location', () => {
    test('Calculate path for nodes', async () => {
        const model = await getModel();
        expect(createPath(model.elements[0])).toEqual('/elements@0');
        expect(createPath((model.elements[2] as PackageDeclaration).elements[1])).toEqual('/elements@2/elements@1');
    });
    test('Locate node for path', async () => {
        const model = await getModel();
        expect(findNode(model, '/elements@0')).toEqual(model.elements[0]);
        expect(findNode(model, '/elements@2/elements@0')).toEqual((model.elements[2] as PackageDeclaration).elements[0]);
    });
});

async function getModel(): Promise<Domainmodel> {
    const doc = await parseDocument(services, datatypeFile);
    const model = doc.parseResult.value as Domainmodel;
    return model;
}

function createPath(node: AstNode): string {
    return services.workspace.AstNodeLocator.getAstNodePath(node);
}

function findNode(node: AstNode, path: string): AstNode | undefined {
    return services.workspace.AstNodeLocator.getAstNode(node, path);
}
