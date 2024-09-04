/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumDocument, ReferenceDescription, URI } from 'langium';
import { AstUtils, EmptyFileSystem, TextDocument } from 'langium';
import { parseDocument } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { createDomainModelServices } from '../src/language-server/domain-model-module.js';
import type { Domainmodel } from '../src/language-server/generated/ast.js';

const { shared, domainmodel } = createDomainModelServices(EmptyFileSystem);

describe('Cross references indexed after affected process', () => {
    test('Fixed reference is in index', async () => {
        const docs = await updateDocuments('entity SomeEntity extends SuperEntity {}', 'entity NoSuperEntity {}');
        const superDoc = docs.super;
        let allRefs = await getReferences((superDoc.parseResult.value as Domainmodel).elements[0]);
        expect(allRefs.length).toEqual(0); // linking error

        shared.workspace.TextDocuments.set(
            TextDocument.create(
                superDoc.textDocument.uri,
                superDoc.textDocument.languageId,
                0,
                'entity SuperEntity {}'
            )
        );

        await shared.workspace.DocumentBuilder.update([superDoc.uri], []);

        const updatedSuperDoc = await shared.workspace.LangiumDocuments.getOrCreateDocument(superDoc.uri);
        const superEntity = (updatedSuperDoc.parseResult.value as Domainmodel).elements[0];
        allRefs = await getReferences(superEntity);
        expect(allRefs.length).toEqual(1); // re-linked

        const extendsEntity = (docs.extends.parseResult.value as Domainmodel).elements[0];
        expect(refString(allRefs[0])).toEqual(nodeRefString(extendsEntity, superEntity));
    });
});

async function updateDocuments(extendsFile: string, superFile: string): Promise<{ 'super': LangiumDocument, 'extends': LangiumDocument }> {
    const superDoc: LangiumDocument = await parseDocument(domainmodel, superFile);
    const extendsDoc: LangiumDocument = await parseDocument(domainmodel, extendsFile);

    await shared.workspace.DocumentBuilder.build([extendsDoc, superDoc]);
    return { 'super': superDoc, 'extends': extendsDoc };
}

async function getReferences(node: AstNode): Promise<ReferenceDescription[]> {
    const allRefs: ReferenceDescription[] = [];
    shared.workspace.IndexManager.findAllReferences(node, createPath(node))
        .forEach((ref) => allRefs.push(ref));
    return allRefs;
}

function refString(ref: ReferenceDescription): string {
    return asString(ref.sourceUri, ref.sourcePath, ref.targetUri, ref.targetPath);
}

function nodeRefString(from: AstNode, to: AstNode): string {
    return asString(AstUtils.getDocument(from).uri, createPath(from), AstUtils.getDocument(to).uri, createPath(to));
}

function createPath(node: AstNode): string {
    return domainmodel.workspace.AstNodeLocator.getAstNodePath(node);
}

function asString(fromUri: URI, fromPath: string, toUri: URI, toPath: string): string {
    return fromUri + fromPath + ' -> ' + toUri + toPath;
}
