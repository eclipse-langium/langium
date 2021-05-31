import { LangiumParser } from './parser/langium-parser';
import { GrammarAccess } from './grammar/grammar-access';
import { AstReflection } from './generator/ast-node';
import { Linker } from './references/linker';
import { NameProvider } from './references/naming';
import { ScopeProvider, ScopeComputation } from './references/scope';

export type LangiumGeneratedServices = {
    Parser: LangiumParser,
    GrammarAccess: GrammarAccess,
    AstReflection: AstReflection
}

export type LangiumServices = LangiumGeneratedServices & {
    references: {
        Linker: Linker,
        NameProvider: NameProvider,
        ScopeProvider: ScopeProvider,
        ScopeComputation: ScopeComputation
    }
}
