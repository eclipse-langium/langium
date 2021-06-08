import { Module } from '../../dependency-injection';
import { LangiumGeneratedServices, LangiumServices } from '../../services';
import { LangiumGrammarAstReflection } from './ast';
import { LangiumGrammarGrammarAccess } from './grammar-access';
import { Parser } from './parser';

export const LangiumGrammarGeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {
    Parser: (injector) => new Parser(injector),
    GrammarAccess: (injector) => new LangiumGrammarGrammarAccess(injector),
    AstReflection: () => new LangiumGrammarAstReflection()
};
