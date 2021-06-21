import { LangiumGeneratedServices, LangiumServices, Module } from 'langium';
import { ArithmeticsAstReflection } from './ast';
import { ArithmeticsGrammarAccess } from './grammar-access';
import { Parser } from './parser';

export const ArithmeticsGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Parser: (injector) => new Parser(injector),
    GrammarAccess: () => new ArithmeticsGrammarAccess(),
    AstReflection: () => new ArithmeticsAstReflection()
};
