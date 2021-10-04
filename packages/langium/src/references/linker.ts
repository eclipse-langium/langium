/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument, LangiumDocuments } from '../documents/document';
import { AstNodeLocator } from '../index/ast-node-locator';
import { LangiumServices } from '../services';
import { AstNode, CstNode, Reference } from '../syntax-tree';
import { getDocument, isAstNode } from '../utils/ast-util';
import { AstNodeDescription, ScopeProvider } from './scope';

export interface Linker {
    /**
     * Unlinks all references within the specified document and removes them from the list of `references`.
     * @param document A LangiumDocument which shall be unlinked.
     */
    unlink(document: LangiumDocument): void;
    getLinkedNode(node: AstNode, refId: string, refText: string): AstNode | LinkingError;
    getCandidate(node: AstNode, refId: string, refText: string): AstNodeDescription | LinkingError;

    /**
     * Creates a cross reference node being aware of its containing AstNode, the corresponding CstNode,
     *  the cross reference text denoting the target AstNode being already extracted of the document text,
     *  as well as the unique cross reference identifier.
     *
     * Default behavior:
     *
     * The returned Reference's 'ref' property pointing to the target AstNode is populated lazily on its
     *  first visit.
     *
     * If the target AstNode cannot be resolved on the first visit, an error indicator will be installed
     *  and further resolution attempts will *not* be performed.
     *
     * @param node the containing AstNode
     * @param refNode the corresponding CstNode
     * @param refId the cross reference identifier like '<entityTypeName>:<propertyName>'
     * @param refText the cross reference text denoting the target AstNode
     * @returns the desired Reference node, whose behavior wrt. resolving the cross reference is implementation specific.
     */
    buildReference(node: AstNode, refNode: CstNode, refId: string, refText: string): Reference;
}

export function getReferenceId(containerTypeName: string, propertyName: string): string {
    return `${containerTypeName}:${propertyName}`;
}

export interface LinkingError {
    cause: 'noDescription' | 'nodeLocatingFailure',
    refId: string,
    refText: string,
    targetDescription?: AstNodeDescription
}

export function isLinkingError(obj: unknown): obj is LinkingError {
    return typeof obj === 'object' && obj !== null && typeof (obj as LinkingError).cause === 'string';
}

interface DefaultReference extends Reference {
    _ref?: AstNode | LinkingError;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly langiumDocuments: () => LangiumDocuments;

    constructor(services: LangiumServices) {
        this.langiumDocuments = () => services.documents.LangiumDocuments;
        this.scopeProvider = services.references.ScopeProvider;
        this.astNodeLocator = services.index.AstNodeLocator;
    }

    getLinkedNode(node: AstNode, refId: string, refText: string): AstNode | LinkingError {
        const description = this.getCandidate(node, refId, refText);
        if (isLinkingError(description)) {
            return description;
        } else {
            const linkedNode = this.loadAstNode(description);
            if (linkedNode !== undefined) {
                return linkedNode;
            } else {
                return {
                    cause: 'nodeLocatingFailure',
                    refId,
                    refText,
                    targetDescription: description
                };
            }
        }
    }

    getCandidate(node: AstNode, refId: string, refText: string): AstNodeDescription | LinkingError {
        const scope = this.scopeProvider.getScope(node, refId);
        const description = scope.getElement(refText);
        if (description !== undefined) {
            return description;
        } else {
            return {
                cause: 'noDescription',
                refId,
                refText
            };
        }
    }

    loadAstNode(nodeDescription: AstNodeDescription): AstNode | undefined {
        if (nodeDescription.node)
            return nodeDescription.node;
        const doc = this.langiumDocuments().getOrCreateDocument(nodeDescription.documentUri);
        return this.astNodeLocator.getAstNode(doc, nodeDescription.path);
    }

    unlink(document: LangiumDocument): void {
        for (const ref of document.references) {
            delete (ref as DefaultReference)._ref;
        }
        document.references = [];
    }

    buildReference(node: AstNode, refNode: CstNode, refId: string, refText: string): Reference {
        // see behavior description in doc of Linker, update that on changes in here
        const getLinkedNode = this.getLinkedNode.bind(this);
        const reference: DefaultReference = {
            $refNode: refNode,
            $refText: refText,
            get ref() {
                if (this._ref === undefined) {
                    this._ref = getLinkedNode(node, refId, refText);
                    getDocument(node).references.push(this);
                }
                return isAstNode(this._ref) ? this._ref : undefined;
            }
        };
        return reference;
    }
}
