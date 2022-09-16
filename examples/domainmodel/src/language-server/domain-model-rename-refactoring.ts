/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, DefaultRenameProvider, findDeclarationNodeAtOffset, isNamed, LangiumDocument, ReferenceDescription, streamAst } from 'langium';
import { Location, WorkspaceEdit } from 'vscode-languageserver';
import { RenameParams } from 'vscode-languageserver-protocol';
import { TextEdit } from 'vscode-languageserver-types';
import { DomainModelNameProvider } from './domain-model-naming';
import { isPackageDeclaration } from './generated/ast';

export class DomainModelRenameProvider extends DefaultRenameProvider {

    async rename(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
        const changes: Record<string, TextEdit[]> = {};
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) return undefined;
        const offset = document.textDocument.offsetAt(params.position);
        const leafNode = findDeclarationNodeAtOffset(rootNode, offset, this.grammarConfig.nameRegexp);
        if (!leafNode) return undefined;
        const targetNode = this.references.findDeclaration(leafNode);
        if (!targetNode) return undefined;
        if (isNamed(targetNode)) targetNode.name = params.newName;
        const options = { onlyLocal: true, includeDeclaration: true };
        const references = this.references.findReferences(targetNode, options);
        references.forEach(ref => {
            const change = TextEdit.replace(ref.segment.range, params.newName);
            const uri = ref.sourceUri.toString();
            if (changes[uri]) {
                changes[uri].push(change);
            } else {
                changes[uri] = [change];
            }
        });

        for (const node of streamAst(targetNode)) {
            const qn = this.buildQualifiedName(node);
            if (qn) {
                const options = { onlyLocal: false, includeDeclaration: false };
                this.references.findReferences(node, options).forEach(reference => {
                    const nodeLocation = this.getRefLocation(reference);
                    const nodeChange = TextEdit.replace(nodeLocation.range, qn);
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

    getRefLocation(ref: ReferenceDescription): Location {
        return Location.create(
            ref.sourceUri.toString(),
            ref.segment.range
        );
    }

    protected buildQualifiedName(node: AstNode): string | undefined {
        let name = this.nameProvider.getName(node);
        if (name) {
            if (isPackageDeclaration(node.$container)) {
                name = (this.nameProvider as DomainModelNameProvider).getQualifiedName(node.$container, name);
            }
        }
        return name;
    }
}
