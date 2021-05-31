import { Module } from './dependency-injection';
import { LangiumServices } from './services';
import { DefaultLinker } from './references/linker';
import { DefaultScopeProvider, ScopeComputation } from './references/scope';
import { DefaultNameProvider } from './references/naming';

export const DefaultModule: Module<LangiumServices> = {
    Parser: () => {
        throw new Error('Not implemented'); // TODO more helpful error message
    },
    GrammarAccess: () => {
        throw new Error('Not implemented'); // TODO more helpful error message
    },
    AstReflection: () => {
        throw new Error('Not implemented'); // TODO more helpful error message
    },

    references: {
        Linker: (injector) => new DefaultLinker(injector),
        NameProvider: () => new DefaultNameProvider(),
        ScopeProvider: (injector) => new DefaultScopeProvider(injector),
        ScopeComputation: (injector) => new ScopeComputation(injector)
    }
};
