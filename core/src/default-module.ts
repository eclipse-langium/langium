import { DIModule } from './dependency-injection';
import { ScopeProvider, DefaultScopeProvider } from './references/scope';

export const DefaultModule: DIModule = container => {
    container.bindToFactory(ScopeProvider, DefaultScopeProvider);
};
