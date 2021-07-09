/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AstReflection } from '../syntax-tree';
import { getDocument, streamAllContents } from '../utils/ast-util';
import { EMPTY_STREAM, Stream, stream } from '../utils/stream';
import { NameProvider } from './naming';
import { LangiumServices } from '../services';
import { LangiumDocument, PrecomputedScopes } from '../documents/document';
import { IndexManager } from '../index/workspace-index-manager';

export interface AstNodeDescription {
    node?: AstNode
    name: string // QualifiedName?
    type: string // AstNodeType?
    documentUri: string // DocumentUri?
}

export interface Scope {
    getElement(name: string): AstNodeDescription | undefined
    getAllElements(): Stream<AstNodeDescription>
}

export class SimpleScope implements Scope {
    readonly elements: Stream<AstNodeDescription>;
    readonly outerScope?: Scope;

    constructor(elements: Stream<AstNodeDescription>, outerScope?: Scope) {
        this.elements = elements;
        this.outerScope = outerScope;
    }

    getAllElements(): Stream<AstNodeDescription> {
        if (this.outerScope) {
            return this.elements.concat(this.outerScope.getAllElements());
        } else {
            return this.elements;
        }
    }

    getElement(name: string): AstNodeDescription | undefined {
        const local = this.elements.find(e => e.name === name);
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
    protected readonly globalScope: IndexManager;

    constructor(services: LangiumServices) {
        this.reflection = services.AstReflection;
        this.globalScope = services.index.IndexManager;
    }

    getScope(node: AstNode, referenceId: string): Scope {
        const precomputed = getDocument(node).precomputedScopes;
        if (!precomputed) {
            return EMPTY_SCOPE;
        }
        const referenceType = this.reflection.getReferenceType(referenceId);

        let currentNode: AstNode | undefined = node;
        const scopes: Array<Stream<AstNodeDescription>> = [];
        do {
            const allDescriptions = precomputed.get(currentNode);
            if (allDescriptions) {
                scopes.push(stream(allDescriptions).filter(
                    desc => this.reflection.isSubtype(desc.type, referenceType)));
            }
            currentNode = currentNode.$container;
        } while (currentNode);

        let result: Scope = this.getGlobalScope();
        for (let i = scopes.length - 1; i >= 0; i--) {
            result = new SimpleScope(scopes[i], result);
        }
        return result;
    }

    // TODO use the global scope (index) as outermost scope
    protected getGlobalScope(): Scope {
        return new SimpleScope(stream(this.globalScope.allElements()));
    }
}

export interface ScopeComputation {
    computeScope(document: LangiumDocument): PrecomputedScopes;
}

export class DefaultScopeComputation implements ScopeComputation {
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    computeScope(document: LangiumDocument): PrecomputedScopes {
        const rootNode = document.parseResult?.value;
        const scopes = new Map();
        if (!rootNode) {
            return scopes;
        }
        streamAllContents(rootNode).forEach(content => {
            const { node } = content;
            const container = node.$container;
            if (container) {
                const name = this.nameProvider.getName(node);
                if (name) {
                    const description = this.createDescription(node, name, document);
                    this.addToContainer(description, container, scopes);
                }
            }
        });
        return scopes;
    }

    protected createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription {
        return {
            node,
            name,
            type: node.$type,
            documentUri: document.uri
        };
    }

    protected addToContainer(description: AstNodeDescription, container: AstNode, scopes: PrecomputedScopes): void {
        if (scopes.has(container)) {
            scopes.get(container)?.push(description);
        } else {
            scopes.set(container, [description]);
        }
    }

}
