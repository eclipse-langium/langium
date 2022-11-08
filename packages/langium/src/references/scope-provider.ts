/******************************************************************************
 * Copyright 2021-2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, AstReflection, ReferenceInfo } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { EMPTY_STREAM, Stream, stream } from '../utils/stream';
import { AstNodeDescriptionProvider } from '../workspace/ast-descriptions';
import { IndexManager } from '../workspace/index-manager';
import { NameProvider } from './name-provider';

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
    getElement(name: string): AstNodeDescription | undefined;

    /**
     * Create a stream of all elements in the scope. This is used to compute completion proposals to be
     * shown in the editor.
     */
    getAllElements(): Stream<AstNodeDescription>;

}

export interface ScopeOptions {
    caseInsensitive?: boolean;
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

    constructor(elements: Stream<AstNodeDescription>, outerScope?: Scope, options?: ScopeOptions) {
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
 * Language-specific service for determining the scope of target elements visible in a specific cross-reference context.
 */
export interface ScopeProvider {

    /**
     * Return a scope describing what elements are visible for the given AST node and cross-reference
     * identifier.
     *
     * @param context Information about the reference for which a scope is requested.
     */
    getScope(context: ReferenceInfo): Scope;

}

export class DefaultScopeProvider implements ScopeProvider {

    protected readonly reflection: AstReflection;
    protected readonly nameProvider: NameProvider;
    protected readonly descriptions: AstNodeDescriptionProvider;
    protected readonly indexManager: IndexManager;

    constructor(services: LangiumServices) {
        this.reflection = services.shared.AstReflection;
        this.nameProvider = services.references.NameProvider;
        this.descriptions = services.workspace.AstNodeDescriptionProvider;
        this.indexManager = services.shared.workspace.IndexManager;
    }

    getScope(context: ReferenceInfo): Scope {
        const scopes: Array<Stream<AstNodeDescription>> = [];
        const referenceType = this.reflection.getReferenceType(context);

        const precomputed = getDocument(context.container).precomputedScopes;
        if (precomputed) {
            let currentNode: AstNode | undefined = context.container;
            do {
                const allDescriptions = precomputed.get(currentNode);
                if (allDescriptions.length > 0) {
                    scopes.push(stream(allDescriptions).filter(
                        desc => this.reflection.isSubtype(desc.type, referenceType)));
                }
                currentNode = currentNode.$container;
            } while (currentNode);
        }

        let result: Scope = this.getGlobalScope(referenceType, context);
        for (let i = scopes.length - 1; i >= 0; i--) {
            result = this.createScope(scopes[i], result);
        }
        return result;
    }

    /**
     * Create a scope for the given collection of AST node descriptions.
     */
    protected createScope(elements: Iterable<AstNodeDescription>, outerScope?: Scope, options?: ScopeOptions): Scope {
        return new StreamScope(stream(elements), outerScope, options);
    }

    /**
     * Create a scope for the given collection of AST nodes, which need to be transformed into respective
     * descriptions first. This is done using the `NameProvider` and `AstNodeDescriptionProvider` services.
     */
    protected createScopeForNodes(elements: Iterable<AstNode>, outerScope?: Scope, options?: ScopeOptions): Scope {
        const s = stream(elements).map(e => {
            const name = this.nameProvider.getName(e);
            if (name) {
                return this.descriptions.createDescription(e, name);
            }
            return undefined;
        }).nonNullable();
        return new StreamScope(s, outerScope, options);
    }

    /**
     * Create a global scope filtered for the given reference type.
     */
    protected getGlobalScope(referenceType: string, _context: ReferenceInfo): Scope {
        return new StreamScope(this.indexManager.allElements(referenceType));
    }

}
