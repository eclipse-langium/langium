/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, CstNode, DefaultRenameHandler, findLeafNodeAtOffset, flattenCst, getDocument, isNamed, LangiumDocument, LangiumDocuments, LangiumServices, LeafCstNode, ReferenceDescription, streamAst} from 'langium';
import { WorkspaceEdit, Location, ReferenceParams } from 'vscode-languageserver';
import { RenameParams } from 'vscode-languageserver-protocol';
import { TextEdit } from 'vscode-languageserver-types';
import { DomainModelNameProvider } from './domain-model-naming';
import {isPackageDeclaration, PackageDeclaration} from './generated/ast';

export class DomainModelRenameHandler extends DefaultRenameHandler {

    protected readonly langiumDocuments: LangiumDocuments;
    constructor(services: LangiumServices) {
        super(services);
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    async renameElement(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
        const changes: Record<string, TextEdit[]> = {};
        const refParams: ReferenceParams = {...params, context: { includeDeclaration: true}};
        const selectedNode = this.getSelectedNode(document, { ...params, context: { includeDeclaration: true } });
        if (!selectedNode) return changes;
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            if (isNamed(targetAstNode)) {
                targetAstNode.name = params.newName;
            }
            const location = this.getLocationTargetAst(targetAstNode, selectedNode, refParams);
            if (location) {
                const change = TextEdit.replace(location.range, params.newName);
                if (changes[location.uri]) {
                    changes[location.uri].push(change);
                } else {
                    changes[location.uri] = [change];
                }
            }
            for (const node of streamAst(targetAstNode)) {
                const  qn = this.buildQualifiedName(node);
                if (qn) {
                    this.references.findReferences(node).forEach(reference => {
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
        }
        return { changes };
    }

    getRefLocation(ref: ReferenceDescription): Location {
        return Location.create(
            ref.sourceUri.toString(),
            ref.segment.range
        );
    }

    getLocationTargetAst(target: AstNode, selectedNode: LeafCstNode, params: ReferenceParams): Location | undefined {
        if (params.context.includeDeclaration) {
            const declDoc = getDocument(target);
            const nameNode = this.findNameNode(target, selectedNode.text);
            if (nameNode) {
                const ref = {docUri: declDoc.uri, range: nameNode.range };
                return Location.create(
                    ref.docUri.toString(),
                    ref.range
                );
            }
        }
        return undefined;
    }

    getSelectedNode(document: LangiumDocument, params: ReferenceParams): LeafCstNode | undefined {
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) {
            return undefined;
        }
        return findLeafNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position));
    }

    protected buildQualifiedName(node: AstNode): string | undefined {
        let name = this.nameProvider.getName(node);
        if (name) {
            if (isPackageDeclaration(node.$container)) {
                name = (this.nameProvider as DomainModelNameProvider).getQualifiedName(node.$container as PackageDeclaration, name);
            }
        }
        return name;
    }

    protected findNameNode(node: AstNode, name: string): CstNode | undefined {
        const nameNode = this.nameProvider.getNameNode(node);
        if (nameNode)
            return nameNode;
        if (node.$cstNode) {
            // try find first leaf with name as text
            const leafNode = flattenCst(node.$cstNode).find((n) => n.text === name);
            if (leafNode)
                return leafNode;
        }
        return node.$cstNode;
    }
}
