import { AstNode, AstReflection } from '../generator/ast-node';
import { BindingKey, Factory, DIService, ServiceHolder } from '../dependency-injection';
import { getDocument, streamAllContents } from '../generator/ast-util';
import { Stream, stream } from '../utils/stream';
import { ParseResult } from '../parser/langium-parser';
import { NameProvider } from './naming';

export interface AstNodeDescription {
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

export type ScopeProvider = (node: AstNode, referenceId: string) => Scope

export const ScopeProvider: BindingKey<ScopeProvider> = { id: 'ScopeProvider' };

export const DefaultScopeProvider: Factory<ScopeProvider> = services => {
    const reflection = services.get(AstReflection);
    return function(node: AstNode, referenceId: string) {
        const precomputed = getDocument(node).precomputedScopes;
        if (!precomputed) {
            return EMPTY_SCOPE;
        }
        const referenceType = reflection.getReferenceType(referenceId);

        let currentNode: AstNode | undefined = node;
        const scopes: Array<Stream<AstNodeDescription>> = [];
        do {
            const allDescriptions = precomputed.get(currentNode);
            if (allDescriptions) {
                scopes.push(stream(allDescriptions).filter(
                    desc => reflection.isSubtype(desc.type, referenceType)));
            }
            currentNode = currentNode.$container;
        } while (currentNode);

        // TODO use the global scope (index) as outermost scope
        let result: Scope = EMPTY_SCOPE;
        for (let i = scopes.length - 1; i >= 0; i--) {
            result = new SimpleScope(scopes[i], result);
        }
        return result;
    };
};

export interface LangiumDocument {
    documentUri: string // DocumentUri?
    parseResult: ParseResult<AstNode>
    precomputedScopes?: Map<AstNode, AstNodeDescription[]>
}

// TODO run scope computation after parsing a new or changed document

export const ScopeComputationKey: BindingKey<ScopeComputation> = { id: 'ScopeComputation' };

export class ScopeComputation implements DIService {

    private nameProvider: NameProvider;

    initialize(services: ServiceHolder): void {
        this.nameProvider = services.get(NameProvider);
    }

    computeScope(document: LangiumDocument): void {
        const scopes = new Map();
        document.precomputedScopes = scopes;
        streamAllContents(document.parseResult.value).forEach(content => {
            const { node } = content;
            const container = node.$container;
            if (container) {
                const name = this.nameProvider(node);
                if (name) {
                    const description = this.createDescription(node, name, document);
                    if (scopes.has(container)) {
                        scopes.get(container)?.push(description);
                    } else {
                        scopes.set(container, [description]);
                    }
                }
            }
        });
    }

    protected createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription {
        return {
            name,
            type: node.$type,
            documentUri: document.documentUri
        };
    }

}
