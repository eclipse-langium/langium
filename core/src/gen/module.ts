import { Module } from '../dependency-injection';
import { LangiumGeneratedServices, LangiumServices } from '../services';
import { LangiumAstReflection } from './ast';
import { LangiumGrammarAccess } from './grammar-access';
import { Parser } from './parser';

export const LangiumGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Parser: (injector) => new Parser(injector),
    GrammarAccess: () => new LangiumGrammarAccess(),
    AstReflection: () => new LangiumAstReflection()
};
