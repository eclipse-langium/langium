/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken } from 'vscode-jsonrpc';
import { LangiumServices } from '../services';
import { AstNode, AstNodeDescription, AstReflection } from '../syntax-tree';
import { AstNodeContent, getDocument, streamAllContents } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { interruptAndCheck } from '../utils/promise-util';
import { EMPTY_STREAM, Stream, stream } from '../utils/stream';
import { AstNodeDescriptionProvider } from '../workspace/ast-descriptions';
import { LangiumDocument, PrecomputedScopes } from '../workspace/documents';
import { IndexManager } from '../workspace/index-manager';
import { NameProvider } from './naming';

export interface Scope {
    getElement(name: string): AstNodeDescription | undefined
    getAllElements(): Stream<AstNodeDescription>
}

export class SimpleScope implements Scope {
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

export interface ScopeProvider {
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
        return new SimpleScope(elements, outerScope);
    }

    /**
     * Create a global scope filtered for the given reference type.
     */
    protected getGlobalScope(referenceType: string): Scope {
        return new SimpleScope(this.indexManager.allElements(referenceType));
    }
}

export interface ScopeComputation {
    /**
     * Computes the scope for a document
     * @param document specified document for scope computation
     * @param cancelToken allows to cancel the current operation
     * @throws `OperationCanceled` if a user action occurs during execution
     */
    computeScope(document: LangiumDocument, cancelToken?: CancellationToken): Promise<PrecomputedScopes>;
}

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
        for (const content of streamAllContents(rootNode)) {
            interruptAndCheck(cancelToken);
            this.processNode(content, document, scopes);
        }
        return scopes;
    }

    protected processNode({ node }: AstNodeContent, document: LangiumDocument, scopes: PrecomputedScopes): void {
        const container = node.$container;
        if (container) {
            const name = this.nameProvider.getName(node);
            if (name) {
                scopes.add(container, this.descriptions.createDescription(node, name, document));
            }
        }
    }

}
