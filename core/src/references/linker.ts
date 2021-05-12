import { AstNode, Reference } from '../generator/ast-node';
import { BindingKey, Factory, ServiceHolder } from '../dependency-injection';
// import { ScopeProvider } from './scope';

export type Linker = (this: ServiceHolder, node: AstNode, reference: Reference<AstNode>, referenceId: string) => void;

export const Linker: BindingKey<Linker> = { id: 'Linker' };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DefaultLinker: Factory<Linker> = services => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return function(node: AstNode, reference: Reference<AstNode>, referenceId: string) {
        // FIXME The 'this' context of type 'void' is not assignable to method's 'this' of type 'ServiceHolder'.
        // const scopeProvider = services.get(ScopeProvider);
        // const scope = scopeProvider(node, referenceId);
    };
};

// TODO inject the linker in the generated parser and use it to lazily link references
