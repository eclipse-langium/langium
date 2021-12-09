/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, LangiumDocument, ReferenceDescription } from 'langium';
import { parseDocument } from 'langium/lib/test';
import { createDomainModelServices } from '../src/language-server/domain-model-module';
import { Domainmodel } from '../src/language-server/generated/ast';

const services = createDomainModelServices().ServiceRegistry.all[0];

const datatypeFile = `
datatype String
datatype Int
datatype Decimal

package big {
    datatype Int
    datatype Decimal
}
`;

const referencingFile = `
 entity Blog {
    title: String
    description: String
    time: big.Int
}
`;
describe('Cross references from declaration', () => {
    test('Find all references', async () => {
        const allRefs = await getReferences();
        expect(allRefs.length).toEqual(2); // datatype String
        expect(range(allRefs[0])).toEqual('2:11->2:17');
        expect(range(allRefs[1])).toEqual('3:17->3:23');
    });
});

async function getReferences(): Promise<ReferenceDescription[]> {
    const datatypeDoc: LangiumDocument = await parseDocument(services, datatypeFile);
    const referencingDoc: LangiumDocument = await parseDocument(services, referencingFile);
    services.shared.workspace.IndexManager.update([referencingDoc, datatypeDoc]);
    const model = (datatypeDoc.parseResult.value as Domainmodel);

    const stringType = model.elements[0];

    const allRefs: ReferenceDescription[] = [];
    services.shared.workspace.IndexManager.findAllReferences(stringType, createPath(stringType))
        .forEach((ref) => allRefs.push(ref));
    return allRefs;
}

function range(ref: ReferenceDescription): string {
    return ref.segment.range.start.line + ':' + ref.segment.range.start.character + '->' + ref.segment.range.end.line + ':' + ref.segment.range.end.character;
}
function createPath(node: AstNode): string {
    return services.index.AstNodeLocator.getAstNodePath(node);
}

