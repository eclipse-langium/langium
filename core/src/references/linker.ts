import { AstNode, Reference } from '../generator/ast-node';
import { BindingKey, Factory, ServiceHolder } from '../dependency-injection';
import { ScopeProvider } from './scope';

export type Linker = (node: AstNode, reference: Reference<AstNode>, referenceId: string) => void;

export const Linker: BindingKey<Linker> = { id: 'Linker' };

export const DefaultLinker: Factory<Linker> = () => {
    return function(this: ServiceHolder, node: AstNode, reference: Reference<AstNode>, referenceId: string) {
        const scopeProvider = this.get(ScopeProvider);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore next-line
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const scope = scopeProvider(node, referenceId);
        // TODO implement linker (see DefaultLinkingService in Xtext)
    };
};

// TODO inject the linker in the generated parser and use it to lazily link references
