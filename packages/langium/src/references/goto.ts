/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Location } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-textdocument';
import { LangiumDocument } from '../documents/document';
import { isAssignment } from '../grammar/generated/ast';
import { LangiumServices } from '../services';
import { CstNode, Reference } from '../syntax-tree';
import { findLeafNodeAtOffset, getContainerOfType, isReference } from '../utils/ast-util';
import { toRange } from '../utils/cst-util';
import { NameProvider } from './naming';

export interface GoToResolver {
    goToDeclaration(document: LangiumDocument, position: Position): Location[]

    findReference(cstNode: CstNode): CstNode | undefined
}

export class DefaultGoToResolverProvider implements GoToResolver {

    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    goToDeclaration(document: LangiumDocument, position: Position): Location[] {
        const rootNode = document.parseResult?.value;
        const locations: Location[] = [];
        if (rootNode && rootNode.$cstNode) {
            const cst = rootNode.$cstNode;
            const sourceCstNode = findLeafNodeAtOffset(cst, document.offsetAt(position));
            if (sourceCstNode) {
                const targetNode = this.findReference(sourceCstNode);
                if (targetNode) {
                    locations.push(Location.create(document.uri, toRange(targetNode, document)));
                }
            }
        }
        return locations;
    }

    findReference(cstNode: CstNode): CstNode | undefined {
        let targetNode = undefined;
        if (cstNode) {
            const assignment = getContainerOfType(cstNode.feature, isAssignment);
            const nodeElem = cstNode.element as unknown as Record<string, Reference>;
            if (assignment && nodeElem) {

                if (isReference(nodeElem[assignment.feature])) {
                    const ref = nodeElem[assignment.feature].ref;
                    if (ref && ref.$cstNode) {
                        targetNode = this.nameProvider.getNameNode(ref);
                        if (!targetNode) {
                            targetNode = ref.$cstNode;
                        }
                    }
                }
            }
        }
        return targetNode;
    }

}
