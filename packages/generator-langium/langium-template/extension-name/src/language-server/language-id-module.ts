import { createDefaultModule, DefaultModuleContext, inject, LangiumServices, Module, PartialLangiumServices } from 'langium';
import { LanguageNameGeneratedModule } from './generated/module';
import { LanguageNameValidationRegistry, LanguageNameValidator } from './language-id-validator';

export type LanguageNameAddedServices = {
    validation: {
        LanguageNameValidator: LanguageNameValidator
    }
}

export type LanguageNameServices = LangiumServices & LanguageNameAddedServices

export const LanguageNameModule: Module<LanguageNameServices, PartialLangiumServices & LanguageNameAddedServices> = {
    validation: {
        ValidationRegistry: (injector) => new LanguageNameValidationRegistry(injector),
        LanguageNameValidator: () => new LanguageNameValidator()
    }
};

export function createLanguageNameServices(context?: DefaultModuleContext): LanguageNameServices {
    return inject(
        createDefaultModule(context),
        LanguageNameGeneratedModule,
        LanguageNameModule
    );
}
