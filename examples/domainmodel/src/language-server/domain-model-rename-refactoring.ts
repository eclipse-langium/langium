/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumDocument, LangiumDocuments, ReferenceDescription } from 'langium';
import type { Range, WorkspaceEdit } from 'vscode-languageserver';
import type { RenameParams } from 'vscode-languageserver-protocol';
import type { URI } from 'vscode-uri';
import type { DomainModelServices } from './domain-model-module.js';
import type { QualifiedNameProvider } from './domain-model-naming.js';
import { DefaultRenameProvider, findDeclarationNodeAtOffset, getDocument, isNamed, streamAst, toDocumentSegment } from 'langium';
import { Location } from 'vscode-languageserver';
import { TextEdit } from 'vscode-languageserver-types';
import { isPackageDeclaration } from './generated/ast.js';

export class DomainModelRenameProvider extends DefaultRenameProvider {

    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly qualifiedNameProvider: QualifiedNameProvider;

    constructor(services: DomainModelServices) {
        super(services);
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
        this.qualifiedNameProvider = services.references.QualifiedNameProvider;
    }

    override async rename(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
        const changes: Record<string, TextEdit[]> = {};
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) return undefined;
        const offset = document.textDocument.offsetAt(params.position);
        const leafNode = findDeclarationNodeAtOffset(rootNode, offset, this.grammarConfig.nameRegexp);
        if (!leafNode) return undefined;
        const targetNode = this.references.findDeclaration(leafNode);
        if (!targetNode) return undefined;
        if (isNamed(targetNode)) targetNode.name = params.newName;
        const location = this.getNodeLocation(targetNode);
        if (location) {
            const change = TextEdit.replace(location.range, params.newName);
            const uri = location.uri;
            if (uri) {
                if (changes[uri]) {
                    changes[uri].push(change);
                } else {
                    changes[uri] = [change];
                }
            }
        }

        for (const node of streamAst(targetNode)) {
            const qn = this.buildQualifiedName(node);
            if (qn) {
                const options = { onlyLocal: false, includeDeclaration: false };
                this.references.findReferences(node, options).forEach(reference => {
                    const nodeLocation = this.getRefLocation(reference);
                    const isQn = this.hasQualifiedNameText(reference.sourceUri, reference.segment.range);
                    let newName = qn;
                    if (!isQn) newName = params.newName;
                    const nodeChange = TextEdit.replace(nodeLocation.range, newName);
                    if (changes[nodeLocation.uri]) {
                        changes[nodeLocation.uri].push(nodeChange);
                    } else {
                        changes[nodeLocation.uri] = [nodeChange];
                    }
                });
            }
        }
        return { changes };
    }

    protected hasQualifiedNameText(uri: URI, range: Range) {
        const langiumDoc = this.langiumDocuments.getOrCreateDocument(uri);
        const rangeText = langiumDoc.textDocument.getText(range);
        return rangeText.includes('.', 0);
    }

    getRefLocation(ref: ReferenceDescription): Location {
        return Location.create(
            ref.sourceUri.toString(),
            ref.segment.range
        );
    }

    getNodeLocation(targetNode: AstNode): Location | undefined {
        const nameNode = this.nameProvider.getNameNode(targetNode);
        if (nameNode) {
            const doc = getDocument(targetNode);
            return Location.create(
                doc.uri.toString(),
                toDocumentSegment(nameNode).range
            );
        }
        return undefined;
    }

    protected buildQualifiedName(node: AstNode): string | undefined {
        if (node.$type === 'Feature') return undefined;
        let name = this.nameProvider.getName(node);
        if (name) {
            if (isPackageDeclaration(node.$container)) {
                name = this.qualifiedNameProvider.getQualifiedName(node.$container, name);
            }
        }
        return name;
    }
}
