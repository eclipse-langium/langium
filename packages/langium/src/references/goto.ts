/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Position } from 'vscode-languageserver-textdocument';
import { LangiumDocument } from '../documents/document';
import { isAssignment } from '../grammar/generated/ast';
import { LangiumServices } from '../services';
import { CstNode, Reference } from '../syntax-tree';
import { findLeafNodeAtOffset, getContainerOfType, isReference } from '../utils/ast-util';
import { NameProvider } from './naming';

export interface GoToResolver {
    goToDeclaration(document: LangiumDocument, position: Position): CstNode[]

    findDeclaration(cstNode: CstNode): CstNode | undefined
}

export class DefaultGoToResolverProvider implements GoToResolver {

    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    goToDeclaration(document: LangiumDocument, position: Position): CstNode[] {
        const rootNode = document.parseResult?.value;
        const targetCstNodes: CstNode[] = [];
        if (rootNode && rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const sourceCstNode = findLeafNodeAtOffset(cst, document.offsetAt(position));
            if (sourceCstNode) {
                const targetNode = this.findDeclaration(sourceCstNode);
                if (targetNode) {
                    targetCstNodes.push(targetNode);
                }
            }
        }
        return targetCstNodes;
    }

    findDeclaration(cstNode: CstNode): CstNode | undefined {
        if (cstNode) {
            const assignment = getContainerOfType(cstNode.feature, isAssignment);
            const nodeElem = cstNode.element as unknown as Record<string, Reference>;
            if (assignment && nodeElem) {

                if (isReference(nodeElem[assignment.feature])) {
                    const ref = nodeElem[assignment.feature].ref;
                    if (ref && ref.$cstNode) {
                        const targetNode = this.nameProvider.getNameNode(ref);
                        if (!targetNode) {
                            return ref.$cstNode;
                        }
                        else {
                            return targetNode;
                        }
                    }
                }
                else {
                    const nameNode = this.nameProvider.getNameNode(cstNode.element);
                    if (nameNode === cstNode) {
                        return cstNode;
                    }
                }
            }
        }
        return undefined;
    }

}
