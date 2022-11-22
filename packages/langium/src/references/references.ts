/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { findAssignment } from '../utils/grammar-util';
import { LangiumServices } from '../services';
import { AstNode, CstNode, GenericAstNode, isReference } from '../syntax-tree';
import { getDocument, streamAst, streamReferences } from '../utils/ast-util';
import { isCstChildNode, toDocumentSegment } from '../utils/cst-util';
import { stream, Stream } from '../utils/stream';
import { equalURI } from '../utils/uri-util';
import { ReferenceDescription } from '../workspace/ast-descriptions';
import { AstNodeLocator } from '../workspace/ast-node-locator';
import { IndexManager } from '../workspace/index-manager';
import { NameProvider } from './name-provider';

/**
 * Language-specific service for finding references and declaration of a given `CstNode`.
 */
export interface References {

    /**
     * If the CstNode is a reference node the target CstNode will be returned.
     * If the CstNode is a significant node of the CstNode this CstNode will be returned.
     *
     * @param sourceCstNode CstNode that points to a AstNode
     */
    findDeclaration(sourceCstNode: CstNode): AstNode | undefined;

    /**
     * If the CstNode is a reference node the target CstNode will be returned.
     * If the CstNode is a significant node of the CstNode this CstNode will be returned.
     *
     * @param sourceCstNode CstNode that points to a AstNode
     */
    findDeclarationNode(sourceCstNode: CstNode): CstNode | undefined;

    /**
     * Finds all references to the target node as references (local references) or reference descriptions.
     *
     * @param targetNode Specified target node whose references should be returned
     */
    findReferences(targetNode: AstNode, options: FindReferencesOptions): Stream<ReferenceDescription>;
}

export interface FindReferencesOptions {
    onlyLocal?: boolean;
    includeDeclaration?: boolean;
}

export class DefaultReferences implements References {
    protected readonly nameProvider: NameProvider;
    protected readonly index: IndexManager;
    protected readonly nodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.index = services.shared.workspace.IndexManager;
        this.nodeLocator = services.workspace.AstNodeLocator;
    }

    findDeclaration(sourceCstNode: CstNode): AstNode | undefined {
        if (sourceCstNode) {
            const assignment = findAssignment(sourceCstNode);
            const nodeElem = sourceCstNode.element;
            if (assignment && nodeElem) {
                const reference = (nodeElem as GenericAstNode)[assignment.feature];

                if (isReference(reference)) {
                    return reference.ref;
                } else if (Array.isArray(reference)) {
                    for (const ref of reference) {
                        if (isReference(ref) && ref.$refNode
                            && ref.$refNode.offset <= sourceCstNode.offset
                            && ref.$refNode.end >= sourceCstNode.end) {
                            return ref.ref;
                        }
                    }
                }
            }
            if (nodeElem) {
                const nameNode = this.nameProvider.getNameNode(nodeElem);
                // Only return the targeted node in case the targeted cst node is the name node or part of it
                if (nameNode && (nameNode === sourceCstNode || isCstChildNode(sourceCstNode, nameNode))) {
                    return nodeElem;
                }
            }
        }
        return undefined;
    }

    findDeclarationNode(sourceCstNode: CstNode): CstNode | undefined {
        const astNode = this.findDeclaration(sourceCstNode);
        if (astNode?.$cstNode) {
            const targetNode = this.nameProvider.getNameNode(astNode);
            if (!targetNode) {
                return astNode.$cstNode;
            } else {
                return targetNode;
            }
        }
        return undefined;
    }

    findReferences(targetNode: AstNode, options: FindReferencesOptions): Stream<ReferenceDescription> {
        if (options.onlyLocal) {
            return this.findLocalReferences(targetNode, options.includeDeclaration);
        } else {
            return this.findGlobalReferences(targetNode, options.includeDeclaration);
        }
    }

    protected findGlobalReferences(targetNode: AstNode, includeDeclaration = false): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        if (includeDeclaration) {
            const ref = this.getReferenceToSelf(targetNode);
            if (ref) {
                refs.push(ref);
            }
        }
        refs.push(...this.index.findAllReferences(targetNode, this.nodeLocator.getAstNodePath(targetNode)));
        return stream(refs);
    }

    protected findLocalReferences(targetNode: AstNode, includeDeclaration = false): Stream<ReferenceDescription> {
        const doc = getDocument(targetNode);
        const rootNode = doc.parseResult.value;
        const refs: ReferenceDescription[] = [];
        if (includeDeclaration) {
            const ref = this.getReferenceToSelf(targetNode);
            if (ref) {
                refs.push(ref);
            }
        }
        streamAst(rootNode).forEach(node => {
            streamReferences(node).forEach(({ reference }) => {
                if (reference.ref === targetNode && reference.$refNode) {
                    const cstNode = reference.$refNode;
                    refs.push({
                        sourceUri: getDocument(cstNode.element).uri,
                        sourcePath: this.nodeLocator.getAstNodePath(cstNode.element),
                        targetUri: getDocument(targetNode).uri,
                        targetPath: this.nodeLocator.getAstNodePath(targetNode),
                        segment: toDocumentSegment(cstNode),
                        local: equalURI(getDocument(cstNode.element).uri, getDocument(targetNode).uri)
                    });
                }
            });
        });
        return stream(refs);
    }

    protected getReferenceToSelf(targetNode: AstNode): ReferenceDescription | undefined {
        const nameNode = this.nameProvider.getNameNode(targetNode);
        if (nameNode) {
            const doc = getDocument(targetNode);
            const path = this.nodeLocator.getAstNodePath(targetNode);
            return {
                sourceUri: doc.uri,
                sourcePath: path,
                targetUri: doc.uri,
                targetPath: path,
                segment: toDocumentSegment(nameNode),
                local: true
            };
        }
        return undefined;
    }
}
