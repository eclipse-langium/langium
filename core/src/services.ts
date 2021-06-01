import { LangiumParser } from './parser/langium-parser';
import { GrammarAccess } from './grammar/grammar-access';
import { AstReflection } from './generator/ast-node';
import { NameProvider } from './references/naming';
import { ScopeProvider, ScopeComputation } from './references/scope';

export type LangiumGeneratedServices = {
    Parser: LangiumParser,
    GrammarAccess: GrammarAccess,
    AstReflection: AstReflection
}

export type LangiumServices = LangiumGeneratedServices & {
    references: {
        NameProvider: NameProvider,
        ScopeProvider: ScopeProvider,
        ScopeComputation: ScopeComputation
    }
}
