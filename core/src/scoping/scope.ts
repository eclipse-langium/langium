import { AstNode } from '../generator/ast-node';
import { BindingKey, DIContainer, DIService } from '../dependency-injection';
import { AstReflection, getDocument, streamAllContents } from '../generator/ast-util';
import { Stream, filterStream, EMPTY_STREAM } from '../utils/stream';

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

export const EMPTY_SCOPE = new SimpleScope(EMPTY_STREAM);

export interface ScopeProvider {
    getScope(node: AstNode, referenceId: string): Scope
}

export const ScopeProvider: BindingKey<ScopeProvider> = { id: 'ScopeProvider' };

export class DefaultScopeProvider implements ScopeProvider, DIService {
    private reflection: AstReflection;

    initialize(container: DIContainer): void {
        this.reflection = container.get(AstReflection);
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
                scopes.push(filterStream(allDescriptions,
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

export interface LangiumDocument {
    documentUri: string // DocumentUri?
    astRoot: AstNode
    precomputedScopes?: Map<AstNode, AstNodeDescription[]>
}

// TODO run scope computation after parsing a new or changed document
export class ScopeComputation {

    computeScope(document: LangiumDocument): void {
        const scopes = new Map();
        document.precomputedScopes = scopes;
        streamAllContents(document.astRoot).forEach(content => {
            const { node } = content;
            const container = node.$container;
            if (container) {
                const name = this.getName(node);
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

    protected getName(node: AstNode): string | undefined {
        if (isNamed(node)) {
            return node.name;
        }
        return undefined;
    }

    protected createDescription(node: AstNode, name: string, document: LangiumDocument): AstNodeDescription {
        return {
            name,
            type: node.$type.toString(), // FIXME
            documentUri: document.documentUri
        };
    }

}

export interface NamedAstNode extends AstNode {
    name: string;
}

export function isNamed(node: AstNode): node is NamedAstNode {
    return (node as NamedAstNode).name !== undefined;
}
