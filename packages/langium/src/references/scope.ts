/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-jsonrpc';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, AstReflection } from '../syntax-tree';
import { getDocument, streamAllContents } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { interruptAndCheck } from '../utils/promise-util';
import { EMPTY_STREAM, Stream, stream } from '../utils/stream';
import { AstNodeDescriptionProvider } from '../workspace/ast-descriptions';
import { LangiumDocument, PrecomputedScopes } from '../workspace/documents';
import { IndexManager } from '../workspace/index-manager';
import { NameProvider } from './naming';

/**
 * A scope describes what target elements are visible from a specific cross-reference context.
 */
export interface Scope {
    /**
     * Find a target element matching the given name. If no element is found, `undefined` is returned.
     * If multiple matching elements are present, the selection of the returned element should be done
     * according to the semantics of your language. Usually it is the element that is most closely defined.
     *
     * @param name Name of the cross-reference target as it appears in the source text.
     */
    getElement(name: string): AstNodeDescription | undefined

    /**
     * Create a stream of all elements in the scope. This is used to compute completion proposals to be
     * shown in the editor.
     */
    getAllElements(): Stream<AstNodeDescription>
}

/**
 * The default scope implementation is based on a `Stream`. It has an optional _outer scope_ describing
 * the next level of elements, which are queried when a target element is not found in the stream provided
 * to this scope.
 */
export class StreamScope implements Scope {
    readonly elements: Stream<AstNodeDescription>;
    readonly outerScope?: Scope;
    readonly caseInsensitive?: boolean;

    constructor(elements: Stream<AstNodeDescription>, outerScope?: Scope, options?: { caseInsensitive?: boolean }) {
        this.elements = elements;
        this.outerScope = outerScope;
        this.caseInsensitive = options?.caseInsensitive;
    }

    getAllElements(): Stream<AstNodeDescription> {
        if (this.outerScope) {
            return this.elements.concat(this.outerScope.getAllElements());
        } else {
            return this.elements;
        }
    }

    getElement(name: string): AstNodeDescription | undefined {
        const local = this.caseInsensitive
            ? this.elements.find(e => e.name.toLowerCase() === name.toLowerCase())
            : this.elements.find(e => e.name === name);
        if (local) {
            return local;
        }
        if (this.outerScope) {
            return this.outerScope.getElement(name);
        }
        return undefined;
    }
}

export const EMPTY_SCOPE: Scope = {
    getElement(): undefined {
        return undefined;
    },
    getAllElements(): Stream<AstNodeDescription> {
        return EMPTY_STREAM;
    }
};

/**
 * Determines the scope of target elements visible in a specific cross-reference context.
 */
export interface ScopeProvider {
    /**
     * Return a scope describing what elements are visible for the given AST node and cross-reference
     * identifier.
     *
     * @param node The AST node holding the cross-reference.
     * @param referenceId Identifier of the cross-reference in the form `Type:property` (see
     *     `getReferenceId` utility function).
     */
    getScope(node: AstNode, referenceId: string): Scope;
}

export class DefaultScopeProvider implements ScopeProvider {
    protected readonly reflection: AstReflection;
    protected readonly indexManager: IndexManager;

    constructor(services: LangiumServices) {
        this.reflection = services.shared.AstReflection;
        this.indexManager = services.shared.workspace.IndexManager;
    }

    getScope(node: AstNode, referenceId: string): Scope {
        const scopes: Array<Stream<AstNodeDescription>> = [];
        const referenceType = this.reflection.getReferenceType(referenceId);

        const precomputed = getDocument(node).precomputedScopes;
        if (precomputed) {
            let currentNode: AstNode | undefined = node;
            do {
                const allDescriptions = precomputed.get(currentNode);
                if (allDescriptions.length > 0) {
                    scopes.push(stream(allDescriptions).filter(
                        desc => this.reflection.isSubtype(desc.type, referenceType)));
                }
                currentNode = currentNode.$container;
            } while (currentNode);
        }

        let result: Scope = this.getGlobalScope(referenceType);
        for (let i = scopes.length - 1; i >= 0; i--) {
            result = this.createScope(scopes[i], result);
        }
        return result;
    }

    /**
     * Create a scope for the given precomputed stream of elements.
     */
    protected createScope(elements: Stream<AstNodeDescription>, outerScope: Scope): Scope {
        return new StreamScope(elements, outerScope);
    }

    /**
     * Create a global scope filtered for the given reference type.
     */
    protected getGlobalScope(referenceType: string): Scope {
        return new StreamScope(this.indexManager.allElements(referenceType));
    }
}

/**
 * This service is executed as part of the _preprocessing_ phase in the `DocumentBuilder`.
 */
export interface ScopeComputation {
    /**
     * Precomputes the scopes for a document. The result is a multimap assigning a set of AST node
     * descriptions to every level of the AST. These data are used by the `ScopeProvider` service
     * to determine which target nodes are visible in the context of a specific cross-reference.
     *
     * _Note:_ You should not resolve any cross-references in this service method. Cross-reference
     * resolution depends on the preprocessing phase to be completed.
     *
     * @param document The document in which to compute scopes.
     * @param cancelToken Indicates when to cancel the current operation.
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    computeScope(document: LangiumDocument, cancelToken?: CancellationToken): Promise<PrecomputedScopes>;
}

/**
 * The default scope computation gathers all AST nodes that have a name (according to the `NameProvider`
 * service) and makes them available in their container node. As a result, from every cross-reference in
 * the AST, target elements from the same level and further up towards the root are visible. Elements that
 * are nested inside lower levels are not visible by default, but that can be changed by customizing this
 * service.
 */
export class DefaultScopeComputation implements ScopeComputation {
    protected readonly nameProvider: NameProvider;
    protected readonly descriptions: AstNodeDescriptionProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.descriptions = services.index.AstNodeDescriptionProvider;
    }

    async computeScope(document: LangiumDocument, cancelToken = CancellationToken.None): Promise<PrecomputedScopes> {
        const rootNode = document.parseResult.value;
        const scopes = new MultiMap<AstNode, AstNodeDescription>();
        for (const node of streamAllContents(rootNode)) {
            interruptAndCheck(cancelToken);
            this.processNode(node, document, scopes);
        }
        return scopes;
    }

    protected processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
        const container = node.$container;
        if (container) {
            const name = this.nameProvider.getName(node);
            if (name) {
                scopes.add(container, this.descriptions.createDescription(node, name, document));
            }
        }
    }

}
