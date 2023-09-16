/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumCoreServices } from '../services.js';
import type { AstNode, CstNode, GenericAstNode } from '../syntax-tree.js';
import type { Stream } from '../utils/stream.js';
import type { ReferenceDescription } from '../workspace/ast-descriptions.js';
import type { AstNodeLocator } from '../workspace/ast-node-locator.js';
import type { IndexManager } from '../workspace/index-manager.js';
import type { NameProvider } from './name-provider.js';
import type { URI } from '../utils/uri-utils.js';
import { findAssignment } from '../utils/grammar-utils.js';
import { isMultiReference, isReference } from '../syntax-tree.js';
import { getDocument, getReferenceNodes, streamAst, streamContents } from '../utils/ast-utils.js';
import { isChildNode, toDocumentSegment } from '../utils/cst-utils.js';
import { stream } from '../utils/stream.js';
import { UriUtils } from '../utils/uri-utils.js';
import { isCrossReference } from '../languages/generated/ast.js';

/**
 * Language-specific service for finding references and declaration of a given `CstNode`.
 */
export interface References {

    /**
     * If the CstNode is a reference node the target AstNodes will be returned.
     * If the CstNode is a significant node of the CstNode this AstNode will be returned.
     *
     * @param sourceCstNode CstNode that points to a AstNode
     */
    findDeclarations(sourceCstNode: CstNode): AstNode[];

    /**
     * If the CstNode is a reference node the target CstNodes will be returned.
     * If the CstNode is a significant node of the CstNode this CstNode will be returned.
     *
     * @param sourceCstNode CstNode that points to a AstNode
     */
    findDeclarationNodes(sourceCstNode: CstNode): CstNode[];

    /**
     * Finds all references to the target node as references (local references) or reference descriptions.
     *
     * @param targetNode Specified target node whose references should be returned
     */
    findReferences(targetNode: AstNode, options: FindReferencesOptions): Stream<ReferenceDescription>;
}

export interface FindReferencesOptions {
    /**
     * When set, the `findReferences` method will only return references/declarations from the specified document.
     */
    documentUri?: URI;
    /**
     * Whether the returned list of references should include the declaration.
     */
    includeDeclaration?: boolean;
}

export class DefaultReferences implements References {
    protected readonly nameProvider: NameProvider;
    protected readonly index: IndexManager;
    protected readonly nodeLocator: AstNodeLocator;
    protected hasMultiReference: boolean;

    constructor(services: LangiumCoreServices) {
        this.nameProvider = services.references.NameProvider;
        this.index = services.shared.workspace.IndexManager;
        this.nodeLocator = services.workspace.AstNodeLocator;
        this.hasMultiReference = streamAst(services.Grammar).some(node => isCrossReference(node) && node.isMulti);
    }

    findDeclarations(sourceCstNode: CstNode): AstNode[] {
        if (sourceCstNode) {
            const assignment = findAssignment(sourceCstNode);
            const nodeElem = sourceCstNode.astNode;
            if (assignment && nodeElem) {
                const reference = (nodeElem as GenericAstNode)[assignment.feature];

                if (isReference(reference) || isMultiReference(reference)) {
                    return getReferenceNodes(reference);
                } else if (Array.isArray(reference)) {
                    for (const ref of reference) {
                        if ((isReference(ref) || isMultiReference(ref)) && ref.$refNode
                            && ref.$refNode.offset <= sourceCstNode.offset
                            && ref.$refNode.end >= sourceCstNode.end) {
                            return getReferenceNodes(ref);
                        }
                    }
                }
            }
            if (nodeElem) {
                const nameNode = this.nameProvider.getNameNode(nodeElem);
                // Only return the targeted node in case the targeted cst node is the name node or part of it
                if (nameNode && (nameNode === sourceCstNode || isChildNode(sourceCstNode, nameNode))) {
                    return this.getSelfNodes(nodeElem);
                }
            }
        }
        return [];
    }

    /**
     * In case your grammar features multi references (i.e. references that can target multiple elements at once),
     * you can override this method to return all possible sibling elements for the specified node. Make sure to return the node itself as well.
     *
     * By default, only direct siblings (i.e. those within the same container of the specified node) with the same name as the specified node are returned.
     * This is also reflected in the builtin implementations of all `Scope` interface.
     * If your language behaves differently, you might need to adjust the `StreamScope` and `MapScope` behavior accordingly.
     */
    protected getSelfNodes(node: AstNode): AstNode[] {
        if (!this.hasMultiReference) {
            return [node];
        } else {
            const name = this.nameProvider.getName(node);
            const container = node.$container;
            // We need the name to find the siblings
            // If the name is not available, we just return the specified node
            // Similarly, we cannot find siblings in case the container is not available
            if (!name || !container) {
                return [node];
            }
            const siblings = streamContents(container).filter(n => this.nameProvider.getName(n) === name);
            return siblings.toArray();
        }
    }

    findDeclarationNodes(sourceCstNode: CstNode): CstNode[] {
        const astNodes = this.findDeclarations(sourceCstNode);
        const cstNodes: CstNode[] = [];
        for (const astNode of astNodes) {
            const cstNode = this.nameProvider.getNameNode(astNode) ?? astNode.$cstNode;
            if (cstNode) {
                cstNodes.push(cstNode);
            }
        }
        return cstNodes;
    }

    findReferences(targetNode: AstNode, options: FindReferencesOptions): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        if (options.includeDeclaration) {
            refs.push(...this.getSelfReferences(targetNode));
        }
        let indexReferences = this.index.findAllReferences(targetNode, this.nodeLocator.getAstNodePath(targetNode));
        if (options.documentUri) {
            indexReferences = indexReferences.filter(ref => UriUtils.equals(ref.sourceUri, options.documentUri));
        }
        refs.push(...indexReferences);
        return stream(refs);
    }

    protected getSelfReferences(targetNode: AstNode): ReferenceDescription[] {
        const selfNodes = this.getSelfNodes(targetNode);
        const references: ReferenceDescription[] = [];
        for (const selfNode of selfNodes) {
            const nameNode = this.nameProvider.getNameNode(selfNode);
            if (nameNode) {
                const doc = getDocument(selfNode);
                const path = this.nodeLocator.getAstNodePath(selfNode);
                references.push({
                    sourceUri: doc.uri,
                    sourcePath: path,
                    targetUri: doc.uri,
                    targetPath: path,
                    segment: toDocumentSegment(nameNode),
                    local: true
                });
            }
        }
        return references;
    }
}
