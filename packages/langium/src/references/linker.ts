/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumCoreServices } from '../services.js';
import type { AstNode, AstNodeDescription, AstReflection, CstNode, LinkingError, MultiReference, MultiReferenceItem, Reference, ReferenceInfo } from '../syntax-tree.js';
import type { AstNodeLocator } from '../workspace/ast-node-locator.js';
import type { LangiumDocument, LangiumDocuments } from '../workspace/documents.js';
import type { ScopeProvider } from './scope-provider.js';
import { CancellationToken } from '../utils/cancellation.js';
import { isAstNode, isAstNodeDescription, isLinkingError } from '../syntax-tree.js';
import { findRootNode, streamAst, streamReferences } from '../utils/ast-utils.js';
import { interruptAndCheck } from '../utils/promise-utils.js';
import { DocumentState } from '../workspace/documents.js';
import type { LangiumProfiler } from '../workspace/profiler.js';

/**
 * Language-specific service for resolving cross-references in the AST.
 */
export interface Linker {

    /**
     * Links all cross-references within the specified document. The default implementation loads only target
     * elements from documents that are present in the `LangiumDocuments` service. The linked references are
     * stored in the document's `references` property.
     *
     * @param document A LangiumDocument that shall be linked.
     * @param cancelToken A token for cancelling the operation.
     *
     * @throws `OperationCancelled` if a cancellation event is detected
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
     * @param refInfo Information about the reference.
     */
    getCandidate(refInfo: ReferenceInfo): AstNodeDescription | LinkingError;

    /**
     * Determines a candidate AST node description for linking the given reference.
     *
     * @param node The AST node containing the reference.
     * @param refId The reference identifier used to build a scope.
     * @param reference The actual reference to resolve.
     */
    getCandidates(refInfo: ReferenceInfo): AstNodeDescription[] | LinkingError;

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
     * @param property The AST node property being referenced
     * @param refNode The corresponding CST node
     * @param refText The cross reference text denoting the target AstNode
     * @returns the desired Reference node, whose behavior wrt. resolving the cross reference is implementation specific.
     */
    buildReference(node: AstNode, property: string, refNode: CstNode | undefined, refText: string): Reference;

    buildMultiReference(node: AstNode, property: string, refNode: CstNode | undefined, refText: string): MultiReference;

}

export const RefResolving = Symbol('RefResolving');

export interface DefaultReference extends Reference {
    _ref?: AstNode | LinkingError | typeof RefResolving;
    _nodeDescription?: AstNodeDescription;
}

export interface DefaultMultiReference extends MultiReference {
    _items: MultiReferenceItem[] | typeof RefResolving | undefined;
    _linkingError?: LinkingError;
}

function defineReferenceContext(reference: object, linker: DefaultLinker, node: AstNode, property: string): void {
    Object.defineProperties(reference, {
        // Keep linker context off Object.keys/reference spreads while sharing prototype accessors.
        linker: { value: linker },
        node: { value: node },
        property: { value: property }
    });
}

class DefaultReferenceImpl implements DefaultReference {
    readonly $refNode: CstNode | undefined;
    readonly $refText: string;
    _ref: AstNode | LinkingError | typeof RefResolving | undefined = undefined;
    _nodeDescription?: AstNodeDescription;

    declare private readonly linker: DefaultLinker;
    declare private readonly node: AstNode;
    declare private readonly property: string;

    constructor(linker: DefaultLinker, node: AstNode, property: string, refNode: CstNode | undefined, refText: string) {
        defineReferenceContext(this, linker, node, property);
        this.$refNode = refNode;
        this.$refText = refText;
    }

    get ref(): AstNode | undefined {
        return this.linker.resolveReference(this, this.node, this.property);
    }

    get $nodeDescription(): AstNodeDescription | undefined {
        return this._nodeDescription;
    }

    get error(): LinkingError | undefined {
        return isLinkingError(this._ref) ? this._ref : undefined;
    }
}

class DefaultMultiReferenceImpl implements DefaultMultiReference {
    readonly $refNode: CstNode | undefined;
    readonly $refText: string;
    _items: MultiReferenceItem[] | typeof RefResolving | undefined = undefined;
    _linkingError?: LinkingError;

    declare private readonly linker: DefaultLinker;
    declare private readonly node: AstNode;
    declare private readonly property: string;

    constructor(linker: DefaultLinker, node: AstNode, property: string, refNode: CstNode | undefined, refText: string) {
        defineReferenceContext(this, linker, node, property);
        this.$refNode = refNode;
        this.$refText = refText;
    }

    get items(): MultiReferenceItem[] {
        return this.linker.resolveMultiReference(this, this.node, this.property);
    }

    get error(): LinkingError | undefined {
        return this.linker.getMultiReferenceError(this, this.node, this.property);
    }
}

export class DefaultLinker implements Linker {
    protected readonly reflection: AstReflection;
    protected readonly scopeProvider: ScopeProvider;
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly langiumDocuments: () => LangiumDocuments;
    protected readonly profiler: LangiumProfiler | undefined;
    protected readonly languageId: string;

    constructor(services: LangiumCoreServices) {
        this.reflection = services.shared.AstReflection;
        this.langiumDocuments = () => services.shared.workspace.LangiumDocuments;
        this.scopeProvider = services.references.ScopeProvider;
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.profiler = services.shared.profilers.LangiumProfiler;
        this.languageId = services.LanguageMetaData.languageId;
    }

    async link(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<void> {
        if (this.profiler?.isActive('linking')) {
            const task = this.profiler.createTask('linking', this.languageId);
            task.start();
            try {
                for (const node of streamAst(document.parseResult.value)) {
                    await interruptAndCheck(cancelToken);
                    streamReferences(node).forEach(ref => {
                        const name = `${node.$type}:${ref.property}`;
                        task.startSubTask(name);
                        try {
                            this.doLink(ref, document);
                        } finally {
                            task.stopSubTask(name);
                        }
                    });
                }
            } finally {
                task.stop();
            }
        }
        else {
            for (const node of streamAst(document.parseResult.value)) {
                await interruptAndCheck(cancelToken);
                streamReferences(node).forEach(ref => this.doLink(ref, document));
            }
        }
    }

    protected doLink(refInfo: ReferenceInfo, document: LangiumDocument): void {
        const ref = refInfo.reference as DefaultReference | DefaultMultiReference;
        // The reference may already have been resolved lazily by accessing its `ref` property.
        if ('_ref' in ref && ref._ref === undefined) {
            ref._ref = RefResolving;
            try {
                const description = this.getCandidate(refInfo);
                if (isLinkingError(description)) {
                    ref._ref = description;
                } else {
                    ref._nodeDescription = description;
                    const linkedNode = this.loadAstNode(description);
                    ref._ref = linkedNode ?? this.createLinkingError(refInfo, description);
                }
            } catch (err) {
                console.error(`An error occurred while resolving reference to '${ref.$refText}':`, err);
                const errorMessage = (err as Error).message ?? String(err);
                ref._ref = {
                    info: refInfo,
                    message: `An error occurred while resolving reference to '${ref.$refText}': ${errorMessage}`
                };
            }
            document.references.push(ref);
        } else if ('_items' in ref && ref._items === undefined) {
            ref._items = RefResolving;
            try {
                const descriptions = this.getCandidates(refInfo);
                const items: MultiReferenceItem[] = [];
                if (isLinkingError(descriptions)) {
                    ref._linkingError = descriptions;
                } else {
                    for (const description of descriptions) {
                        const linkedNode = this.loadAstNode(description);
                        if (linkedNode) {
                            items.push({ ref: linkedNode, $nodeDescription: description });
                        }
                    }
                }
                ref._items = items;
            } catch (err) {
                ref._linkingError = {
                    info: refInfo,
                    message: `An error occurred while resolving reference to '${ref.$refText}': ${err}`
                };
                ref._items = [];
            }
            document.references.push(ref);
        }
    }

    unlink(document: LangiumDocument): void {
        for (const ref of document.references) {
            if ('_ref' in ref) {
                (ref as DefaultReference)._ref = undefined;
                delete (ref as DefaultReference)._nodeDescription;
            } else if ('_items' in ref) {
                (ref as DefaultMultiReference)._items = undefined;
                delete (ref as DefaultMultiReference)._linkingError;
            }
        }
        document.references = [];
    }

    getCandidate(refInfo: ReferenceInfo): AstNodeDescription | LinkingError {
        const scope = this.scopeProvider.getScope(refInfo);
        const description = scope.getElement(refInfo.reference.$refText);
        return description ?? this.createLinkingError(refInfo);
    }

    getCandidates(refInfo: ReferenceInfo): AstNodeDescription[] | LinkingError {
        const scope = this.scopeProvider.getScope(refInfo);
        const descriptions = scope.getElements(refInfo.reference.$refText).distinct(desc => `${desc.documentUri}#${desc.path}`).toArray();
        return descriptions.length > 0 ? descriptions : this.createLinkingError(refInfo);
    }

    buildReference(node: AstNode, property: string, refNode: CstNode | undefined, refText: string): Reference {
        // See behavior description in doc of Linker, update that on changes in here.
        return new DefaultReferenceImpl(this, node, property, refNode, refText);
    }

    buildMultiReference(node: AstNode, property: string, refNode: CstNode | undefined, refText: string): MultiReference {
        // See behavior description in doc of Linker, update that on changes in here.
        return new DefaultMultiReferenceImpl(this, node, property, refNode, refText);
    }

    /** @internal */
    resolveReference(reference: DefaultReference, node: AstNode, property: string): AstNode | undefined {
        if (isAstNode(reference._ref)) {
            // Most frequent case: the target is already resolved.
            return reference._ref;
        } else if (isAstNodeDescription(reference._nodeDescription)) {
            // A candidate has been found before, but it is not loaded yet.
            const linkedNode = this.loadAstNode(reference._nodeDescription);
            reference._ref = linkedNode ??
                this.createLinkingError({ reference, container: node, property }, reference._nodeDescription);
        } else if (reference._ref === undefined) {
            // The reference has not been linked yet, so do that now.
            reference._ref = RefResolving;
            const document = findRootNode(node).$document;
            const refData = this.getLinkedNode({ reference, container: node, property });
            if (refData.error && document && document.state < DocumentState.ComputedScopes) {
                // Document scope is not ready, don't set `reference._ref` so linker can retry later.
                return reference._ref = undefined;
            }
            reference._ref = refData.node ?? refData.error;
            reference._nodeDescription = refData.descr;
            document?.references.push(reference);
        } else if (reference._ref === RefResolving) {
            this.throwCyclicReferenceError(node, property, reference.$refText);
        }
        return isAstNode(reference._ref) ? reference._ref : undefined;
    }

    /** @internal */
    resolveMultiReference(reference: DefaultMultiReference, node: AstNode, property: string): MultiReferenceItem[] {
        if (Array.isArray(reference._items)) {
            return reference._items;
        } else if (reference._items === undefined) {
            reference._items = RefResolving;
            const document = findRootNode(node).$document;
            const descriptions = this.getCandidates({
                reference,
                container: node,
                property
            });
            const items: MultiReferenceItem[] = [];
            if (isLinkingError(descriptions)) {
                reference._linkingError = descriptions;
            } else {
                for (const description of descriptions) {
                    const linkedNode = this.loadAstNode(description);
                    if (linkedNode) {
                        items.push({ ref: linkedNode, $nodeDescription: description });
                    }
                }
            }
            reference._items = items;
            document?.references.push(reference);
        } else if (reference._items === RefResolving) {
            this.throwCyclicReferenceError(node, property, reference.$refText);
        }
        return Array.isArray(reference._items) ? reference._items : [];
    }

    /** @internal */
    getMultiReferenceError(reference: DefaultMultiReference, node: AstNode, property: string): LinkingError | undefined {
        if (reference._linkingError) {
            return reference._linkingError;
        }
        const refs = this.resolveMultiReference(reference, node, property);
        if (refs.length > 0) {
            return undefined;
        } else {
            return (reference._linkingError = this.createLinkingError({ reference, container: node, property }));
        }
    }

    protected throwCyclicReferenceError(node: AstNode, property: string, refText: string): never {
        throw new Error(`Cyclic reference resolution detected: ${this.astNodeLocator.getAstNodePath(node)}/${property} (symbol '${refText}')`);
    }

    protected getLinkedNode(refInfo: ReferenceInfo): { node?: AstNode, descr?: AstNodeDescription, error?: LinkingError } {
        try {
            const description = this.getCandidate(refInfo);
            if (isLinkingError(description)) {
                return { error: description };
            }
            const linkedNode = this.loadAstNode(description);
            if (linkedNode) {
                return { node: linkedNode, descr: description };
            }
            else {
                return {
                    descr: description,
                    error:
                        this.createLinkingError(refInfo, description)
                };
            }
        } catch (err) {
            console.error(`An error occurred while resolving reference to '${refInfo.reference.$refText}':`, err);
            const errorMessage = (err as Error).message ?? String(err);
            return {
                error: {
                    info: refInfo,
                    message: `An error occurred while resolving reference to '${refInfo.reference.$refText}': ${errorMessage}`
                }
            };
        }
    }

    protected loadAstNode(nodeDescription: AstNodeDescription): AstNode | undefined {
        if (nodeDescription.node) {
            return nodeDescription.node;
        }
        const doc = this.langiumDocuments().getDocument(nodeDescription.documentUri);
        if (!doc) {
            return undefined;
        }
        return this.astNodeLocator.getAstNode(doc.parseResult.value, nodeDescription.path);
    }

    protected createLinkingError(refInfo: ReferenceInfo, targetDescription?: AstNodeDescription): LinkingError {
        // Check whether the document is sufficiently processed by the DocumentBuilder. If not, this is a hint for a bug
        // in the language implementation.
        const document = findRootNode(refInfo.container).$document;
        if (document && document.state < DocumentState.ComputedScopes) {
            console.warn(`Attempted reference resolution before document reached ComputedScopes state (${document.uri}).`);
        }
        const referenceType = this.reflection.getReferenceType(refInfo);
        return {
            info: refInfo,
            message: `Could not resolve reference to ${referenceType} named '${refInfo.reference.$refText}'.`,
            targetDescription
        };
    }

}
