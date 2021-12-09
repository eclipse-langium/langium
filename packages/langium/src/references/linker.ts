/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-languageserver';
import { ReferenceInfo } from '..';
import { LangiumDocument, LangiumDocuments } from '../documents/document';
import { AstNodeLocator } from '../index/ast-node-locator';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, CstNode, LinkingError, Reference } from '../syntax-tree';
import { isAstNode, isAstNodeDescription, isLinkingError, streamAllContents, streamReferences } from '../utils/ast-util';
import { interruptAndCheck } from '../utils/promise-util';
import { ScopeProvider } from './scope';

/**
 * This service is responsible for resolving cross-references in the AST.
 */
export interface Linker {
    /**
     * Links all cross-references within the specified document. The default implementation loads only target
     * elements from documents that are present in the `LangiumDocuments` service.
     *
     * @param document A LangiumDocument that shall be linked.
     * @param cancelToken A token for cancelling the operation.
     */
    link(document: LangiumDocument, cancelToken?: CancellationToken): Promise<void>;

    /**
     * Unlinks all references within the specified document and removes them from the list of `references`.
     *
     * @param document A LangiumDocument that shall be unlinked.
     */
    unlink(document: LangiumDocument): void;

    /**
     * Determines a candidate AST node description for linking the given reference.
     *
     * @param node The AST node containing the reference.
     * @param refId The reference identifier used to build a scope.
     * @param reference The actual reference to resolve.
     */
    getCandidate(node: AstNode, refId: string, reference: Reference): AstNodeDescription | LinkingError;

    /**
     * Creates a cross reference node being aware of its containing AstNode, the corresponding CstNode,
     * the cross reference text denoting the target AstNode being already extracted of the document text,
     * as well as the unique cross reference identifier.
     *
     * Default behavior:
     *  - The returned Reference's 'ref' property pointing to the target AstNode is populated lazily on its
     *    first visit.
     *  - If the target AstNode cannot be resolved on the first visit, an error indicator will be installed
     *    and further resolution attempts will *not* be performed.
     *
     * @param node The containing AST node
     * @param refNode The corresponding CST node
     * @param refId The cross reference identifier like '<entityTypeName>:<propertyName>'
     * @param refText The cross reference text denoting the target AstNode
     * @returns the desired Reference node, whose behavior wrt. resolving the cross reference is implementation specific.
     */
    buildReference(node: AstNode, refNode: CstNode, refId: string, refText: string): Reference;
}

export function getReferenceId(containerTypeName: string, propertyName: string): string {
    return `${containerTypeName}:${propertyName}`;
}

export function getReferenceProperty(referenceId: string): string {
    return referenceId.substring(referenceId.indexOf(':') + 1);
}

interface DefaultReference extends Reference {
    _ref?: AstNode | AstNodeDescription | LinkingError;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly langiumDocuments: () => LangiumDocuments;

    constructor(services: LangiumServices) {
        this.langiumDocuments = () => services.shared.workspace.LangiumDocuments;
        this.scopeProvider = services.references.ScopeProvider;
        this.astNodeLocator = services.index.AstNodeLocator;
    }

    async link(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<void> {
        const process = (node: AstNode) => {
            streamReferences(node).forEach(ref => this.doLink(ref, document));
        };
        const rootNode = document.parseResult.value;
        process(rootNode);
        for (const content of streamAllContents(rootNode)) {
            await interruptAndCheck(cancelToken);
            process(content.node);
        }
    }

    protected doLink(info: ReferenceInfo, document: LangiumDocument): void {
        const ref = info.reference as DefaultReference;
        // The reference may already have been resolved lazily by accessing its `ref` property.
        if (ref._ref === undefined) {
            try {
                const refId = getReferenceId(info.container.$type, info.property);
                const description = this.getCandidate(info.container, refId, ref);
                if (!isLinkingError(description) && this.langiumDocuments().hasDocument(description.documentUri)) {
                    // The target document is already loaded
                    const linkedNode = this.loadAstNode(description);
                    ref._ref = linkedNode ?? this.createLinkingError(info, description);
                } else {
                    // The target document is not loaded yet, or the target was not found in the scope
                    ref._ref = description;
                }
            } catch (err) {
                ref._ref = {
                    ...info,
                    message: `An error occurred while resolving reference to '${ref.$refText}': ${err}`
                };
            }
        }
        // Add the reference to the document's array of references
        document.references.push(ref);
    }

    unlink(document: LangiumDocument): void {
        for (const ref of document.references) {
            delete (ref as DefaultReference)._ref;
        }
        document.references = [];
    }

    getCandidate(container: AstNode, refId: string, reference: Reference): AstNodeDescription | LinkingError {
        const scope = this.scopeProvider.getScope(container, refId);
        const description = scope.getElement(reference.$refText);
        return description ?? this.createLinkingError({ container, property: getReferenceProperty(refId), reference });
    }

    buildReference(node: AstNode, refNode: CstNode, refId: string, refText: string): Reference {
        // See behavior description in doc of Linker, update that on changes in here.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const linker = this;
        const reference: DefaultReference = {
            $refNode: refNode,
            $refText: refText,

            get ref() {
                if (isAstNode(this._ref)) {
                    // Most frequent case: the target is aready resolved.
                    return this._ref;
                } else if (this._ref === undefined) {
                    // The reference has not been linked yet, so do that now.
                    this._ref = linker.getLinkedNode(node, refId, reference);
                } else if (isAstNodeDescription(this._ref)) {
                    // A candidate has been found before, but it is not loaded yet.
                    const linkedNode = linker.loadAstNode(this._ref);
                    this._ref = linkedNode ??
                        linker.createLinkingError({ container: node, property: getReferenceProperty(refId), reference }, this._ref);
                }
                return isAstNode(this._ref) ? this._ref : undefined;
            },

            get error() {
                return isLinkingError(this._ref) ? this._ref : undefined;
            }
        };
        return reference;
    }

    protected getLinkedNode(container: AstNode, refId: string, reference: Reference): AstNode | LinkingError {
        try {
            const description = this.getCandidate(container, refId, reference);
            if (isLinkingError(description)) {
                return description;
            } else {
                const linkedNode = this.loadAstNode(description);
                return linkedNode ??
                    this.createLinkingError({ container, property: getReferenceProperty(refId), reference }, description);
            }
        } catch (err) {
            return {
                container,
                property: getReferenceProperty(refId),
                reference,
                message: `An error occurred while resolving reference to '${reference.$refText}': ${err}`
            };
        }
    }

    protected loadAstNode(nodeDescription: AstNodeDescription): AstNode | undefined {
        if (nodeDescription.node) {
            return nodeDescription.node;
        }
        const doc = this.langiumDocuments().getOrCreateDocument(nodeDescription.documentUri);
        return this.astNodeLocator.getAstNode(doc, nodeDescription.path);
    }

    protected createLinkingError(refInfo: ReferenceInfo, targetDescription?: AstNodeDescription): LinkingError {
        return {
            ...refInfo,
            message: `Could not resolve reference to '${refInfo.reference.$refText}'.`,
            targetDescription
        };
    }

}
