import { DIModule } from './dependency-injection';
import { ScopeProvider, DefaultScopeProvider, ScopeComputationKey, ScopeComputation } from './references/scope';
import { NameProvider, DefaultNameProvider } from './references/naming';

export const DefaultModule: DIModule = container => {
    container.bindToFactory(NameProvider, DefaultNameProvider);
    container.bindToFactory(ScopeProvider, DefaultScopeProvider);
    container.bindToConstructor(ScopeComputationKey, ScopeComputation);
};
