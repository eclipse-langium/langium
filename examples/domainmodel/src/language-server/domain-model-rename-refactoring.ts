/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumDocument, LangiumDocuments, ReferenceDescription, URI } from 'langium';
import { AstUtils, CstUtils, isNamed } from 'langium';
import { DefaultRenameProvider } from 'langium/lsp';
import type { RenameParams } from 'vscode-languageserver-protocol';
import { Location, TextEdit, type Range, type WorkspaceEdit } from 'vscode-languageserver-types';
import type { DomainModelServices } from './domain-model-module.js';
import type { QualifiedNameProvider } from './domain-model-naming.js';
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
        const leafNode = CstUtils.findDeclarationNodeAtOffset(rootNode, offset, this.grammarConfig.nameRegexp);
        if (!leafNode) return undefined;
        const targetNodes = this.references.findDeclarations(leafNode);
        if (!targetNodes.length) return undefined;
        for (const node of targetNodes) {
            if (isNamed(node)) node.name = params.newName;
            const location = this.getNodeLocation(node);
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
        }
        const targetNode = targetNodes[0];
        for (const node of AstUtils.streamAst(targetNode)) {
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

    protected hasQualifiedNameText(uri: URI, range: Range): boolean {
        const langiumDoc = this.langiumDocuments.getDocument(uri);
        if (!langiumDoc) {
            return false;
        }
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
            const doc = AstUtils.getDocument(targetNode);
            return Location.create(
                doc.uri.toString(),
                CstUtils.toDocumentSegment(nameNode).range
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
