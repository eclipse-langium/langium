/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { findAssignment } from '../grammar/grammar-util';
import { ReferenceDescription } from '../index/ast-descriptions';
import { AstNodeLocator } from '../index/ast-node-locator';
import { IndexManager } from '../index/index-manager';
import { LangiumServices } from '../services';
import { AstNode, CstNode, Reference } from '../syntax-tree';
import { isReference } from '../utils/ast-util';
import { findRelevantNode } from '../utils/cst-util';
import { Stream } from '../utils/stream';
import { NameProvider } from './naming';

export interface References {

    /**
     * If the CstNode is a reference node the target CstNode will be returned.
     * If the CstNode is a significant node of the CstNode this CstNode will be returned.
     *
     * @param sourceCstNode CstNode that points to a AstNode
     */
    findDeclaration(sourceCstNode: CstNode): CstNode | undefined;
    /**
     * Finds all references to the target node as references (local references) or reference descriptions.
     *
     * @param targetNode Specified target node whose references should be returned
     */
    findReferences(targetNode: AstNode): Stream<ReferenceDescription>;
}

export class DefaultReferences implements References {
    protected readonly nameProvider: NameProvider;
    protected readonly index: IndexManager;
    protected readonly nodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.index = services.shared.workspace.IndexManager;
        this.nodeLocator = services.index.AstNodeLocator;
    }

    findDeclaration(sourceCstNode: CstNode): CstNode | undefined {
        if (sourceCstNode) {
            const assignment = findAssignment(sourceCstNode);
            const nodeElem = findRelevantNode(sourceCstNode);
            if (assignment && nodeElem) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const reference = (nodeElem as any)[assignment.feature] as unknown;

                if (isReference(reference)) {
                    return this.processReference(reference);
                }
                else if (Array.isArray(reference)) {
                    for (const ref of reference) {
                        if (isReference(ref)) {
                            const target = this.processReference(ref);
                            if (target && target.text === sourceCstNode.text) return target;
                        }
                    }
                }
                else {
                    const nameNode = this.nameProvider.getNameNode(nodeElem);
                    if (nameNode === sourceCstNode
                        || nameNode && nameNode.offset <= sourceCstNode.offset
                        && nameNode.offset + nameNode.length > sourceCstNode.offset) {
                        return nameNode;
                    }
                }
            }
        }
        return undefined;
    }

    findReferences(targetNode: AstNode): Stream<ReferenceDescription> {
        return this.index.findAllReferences(targetNode, this.nodeLocator.getAstNodePath(targetNode));
    }

    protected processReference(reference: Reference): CstNode | undefined {
        const ref = reference.ref;
        if (ref && ref.$cstNode) {
            const targetNode = this.nameProvider.getNameNode(ref);
            if (!targetNode) {
                return ref.$cstNode;
            }
            else {
                return targetNode;
            }
        }
        return undefined;
    }

}
