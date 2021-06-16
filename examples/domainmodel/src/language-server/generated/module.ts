import { LangiumGeneratedServices, LangiumServices, Module } from 'langium';
import { DomainModelAstReflection } from './ast';
import { DomainModelGrammarAccess } from './grammar-access';
import { Parser } from './parser';

export const DomainModelGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Parser: (injector) => new Parser(injector),
    GrammarAccess: () => new DomainModelGrammarAccess(),
    AstReflection: () => new DomainModelAstReflection()
};
