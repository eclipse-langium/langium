/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, getDocument, LangiumDocument, ReferenceDescription } from 'langium';
import { parseDocument } from 'langium/lib/test';
import { TextDocument } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { createDomainModelServices } from '../src/language-server/domain-model-module';
import { Domainmodel } from '../src/language-server/generated/ast';

const services = createDomainModelServices().domainmodel;

describe('Cross references indexed after affected process', () => {
    test('Fixed reference is in index', async () => {
        const docs = await updateDocuments('entity SomeEntity extends SuperEntity {}', 'entity NoSuperEntity {}');
        const superDoc = docs.super;
        let allRefs = await getReferences((superDoc.parseResult.value as Domainmodel).elements[0]);
        expect(allRefs.length).toEqual(0); // linking error

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textDocs: any = services.shared.workspace.TextDocuments;
        textDocs._documents[superDoc.textDocument.uri.toString()] =
            TextDocument.create(superDoc.textDocument.uri.toString(), superDoc.textDocument.languageId, 0, 'entity SuperEntity {}');
        await services.shared.workspace.DocumentBuilder.update([superDoc.uri], []);

        const updatedSuperDoc = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(superDoc.uri);
        const superEntity = (updatedSuperDoc.parseResult.value as Domainmodel).elements[0];
        allRefs = await getReferences(superEntity);
        expect(allRefs.length).toEqual(1); // re-linked

        const extendsEntity = (docs.extends.parseResult.value as Domainmodel).elements[0];
        expect(refString(allRefs[0])).toEqual(nodeRefString(extendsEntity, superEntity));
    });
});

async function updateDocuments(extendsFile: string, superFile: string): Promise<{ 'super': LangiumDocument, 'extends': LangiumDocument }> {
    const superDoc: LangiumDocument = await parseDocument(services, superFile);
    const extendsDoc: LangiumDocument = await parseDocument(services, extendsFile);
    services.shared.workspace.LangiumDocuments.addDocument(superDoc);
    services.shared.workspace.LangiumDocuments.addDocument(extendsDoc);

    await services.shared.workspace.DocumentBuilder.build([extendsDoc, superDoc]);
    return { 'super': superDoc, 'extends': extendsDoc };
}

async function getReferences(node: AstNode): Promise<ReferenceDescription[]> {
    const allRefs: ReferenceDescription[] = [];
    services.shared.workspace.IndexManager.findAllReferences(node, createPath(node))
        .forEach((ref) => allRefs.push(ref));
    return allRefs;
}

function refString(ref: ReferenceDescription): string {
    return asString(ref.sourceUri, ref.sourcePath, ref.targetUri, ref.targetPath);
}

function nodeRefString(from: AstNode, to: AstNode): string {
    return asString(getDocument(from).uri, createPath(from), getDocument(to).uri, createPath(to));
}

function createPath(node: AstNode): string {
    return services.index.AstNodeLocator.getAstNodePath(node);
}

function asString(fromUri: URI, fromPath: string, toUri: URI, toPath: string): string {
    return fromUri + fromPath + ' -> ' + toUri + toPath;
}