/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { isAssignment } from '../grammar/generated/ast';
import { LangiumServices } from '../services';
import { CstNode, Reference } from '../syntax-tree';
import { getContainerOfType, isReference } from '../utils/ast-util';

import { NameProvider } from './naming';

export interface References {

    /**
     * If the CstNode is a reference node the target CstNode will be returned.
     * If the CstNode is a significant node of the CstNode this CstNode will be returned.
     *
     * @param sourceCstNode CstNode we that point to a AstNode
     */
    findDeclaration(sourceCstNode: CstNode): CstNode | undefined;
}

export class DefaultReferences implements References {
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    findDeclaration(sourceCstNode: CstNode): CstNode | undefined {
        if (sourceCstNode) {
            const assignment = getContainerOfType(sourceCstNode.feature, isAssignment);
            const nodeElem = sourceCstNode.element as unknown as Record<string, Reference>;
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
                    const nameNode = this.nameProvider.getNameNode(sourceCstNode.element);
                    if (nameNode === sourceCstNode) {
                        return sourceCstNode;
                    }
                }
            }
        }
        return undefined;
    }

}