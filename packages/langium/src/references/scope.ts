import { AstNode, AstReflection } from '../syntax-tree';
import { getDocument, streamAllContents } from '../utils/ast-util';
import { Stream, stream } from '../utils/stream';
import { NameProvider } from './naming';
import { LangiumServices } from '../services';
import { PrecomputedScopes } from '../documents/document';

export interface AstNodeDescription {
    node?: AstNode
    name: string // QualifiedName?
    type: string // AstNodeType?
    documentUri: string // DocumentUri?
}

export interface Scope {
    getElement(name: string): AstNodeDescription | undefined
}

export class SimpleScope implements Scope {
    readonly elements: Stream<AstNodeDescription>;
    readonly outerScope?: Scope;

    constructor(elements: Stream<AstNodeDescription>, outerScope?: Scope) {
        this.elements = elements;
        this.outerScope = outerScope;
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
    }
};

export interface ScopeProvider {
    getScope(node: AstNode, referenceId: string): Scope;
}

export class DefaultScopeProvider implements ScopeProvider {
    protected readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.reflection = services.AstReflection;
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

        // TODO use the global scope (index) as outermost scope
        let result: Scope = EMPTY_SCOPE;
        for (let i = scopes.length - 1; i >= 0; i--) {
            result = new SimpleScope(scopes[i], result);
        }
        return result;
    }
}

export interface ScopeComputation {
    computeScope(rootNode: AstNode): PrecomputedScopes;
}

export class DefaultScopeComputation implements ScopeComputation {
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    computeScope(rootNode: AstNode): PrecomputedScopes {
        const scopes = new Map();
        streamAllContents(rootNode).forEach(content => {
            const { node } = content;
            const container = node.$container;
            if (container) {
                const name = this.nameProvider.getName(node);
                if (name) {
                    const description = this.createDescription(node, name);
                    if (scopes.has(container)) {
                        scopes.get(container)?.push(description);
                    } else {
                        scopes.set(container, [description]);
                    }
                }
            }
        });
        return scopes;
    }

    protected createDescription(node: AstNode, name: string): AstNodeDescription {
        const document = getDocument(node);
        return {
            node,
            name,
            type: node.$type,
            documentUri: document.uri
        };
    }

}
