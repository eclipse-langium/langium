import { Module, inject } from '../dependency-injection';
import { LangiumGrammarValidator } from './langium-grammar-validator';
import { PartialLangiumServices, LangiumServices } from '../services';
import { DefaultModuleContext, createDefaultModule } from '../default-module';
import { LangiumGeneratedModule } from '../gen/module';

export const LangiumGrammarModule: Module<PartialLangiumServices> = {
    validation: {
        Validator: () => new LangiumGrammarValidator()
    }
};

export function createLangiumGrammarServices(context?: DefaultModuleContext): LangiumServices {
    return inject(
        createDefaultModule(context),
        LangiumGeneratedModule,
        LangiumGrammarModule
    );
}
