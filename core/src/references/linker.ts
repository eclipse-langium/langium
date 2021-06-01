import { LangiumServices } from '../services';
import { AstNode, Reference } from '../generator/ast-node';
import { ScopeProvider } from './scope';

export interface Linker {
    link(node: AstNode, reference: Reference<AstNode>, referenceId: string): void;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
    }

    link(node: AstNode, reference: Reference<AstNode>, referenceId: string): void {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore next-line
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const scope = this.scopeProvider.getScope(node, referenceId);
        // TODO implement linker (see DefaultLinkingService in Xtext)
    }
}

// TODO inject the linker in the generated parser and use it to lazily link references
