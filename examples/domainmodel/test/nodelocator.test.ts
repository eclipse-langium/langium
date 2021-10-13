/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, LangiumDocument } from 'langium';
import { parseDocument } from 'langium/lib/test';
import { createDomainModelServices } from '../src/language-server/domain-model-module';
import { Domainmodel } from '../src/language-server/generated/ast';

const services = createDomainModelServices();

const datatypeFile = `
datatype Int
datatype Decimal

package big {
    datatype Int
    datatype Decimal
}
 `;

describe('AstNode location', () => {
    const doc = parseDocument<Domainmodel>(services, datatypeFile);
    const model = doc.parseResult.value;
    if (!model) {
        throw new Error('Could not parse document');
    }

    test('Calculate path for nodes', () => {
        expect(createPath(model.elements[0])).toEqual('/elements@0');
        expect(createPath(model.elements[2].elements[1])).toEqual('/elements@2/elements@1');
    });
    test('Locate node for path', () => {
        expect(findNode(doc, '/elements@0')).toEqual(model.elements[0]);
        expect(findNode(doc, '/elements@2/elements@0')).toEqual(model.elements[2].elements[0]);
    });
});

function createPath(node: AstNode): string {
    return services.index.AstNodeLocator.getAstNodePath(node);
}

function findNode(document: LangiumDocument, path: string): AstNode | undefined {
    return services.index.AstNodeLocator.getAstNode(document, path);
}
