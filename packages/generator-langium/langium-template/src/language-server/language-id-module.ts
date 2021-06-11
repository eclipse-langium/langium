import { createDefaultModule, DefaultModuleContext, inject, LangiumServices, Module, PartialLangiumServices } from 'langium';
import { <%= LanguageName %>GeneratedModule } from './generated/module';
import { <%= LanguageName %>ValidationRegistry, <%= LanguageName %>Validator } from './<%= language-id %>-validator';

export type <%= LanguageName %>AddedServices = {
    validation: {
        <%= LanguageName %>Validator: <%= LanguageName %>Validator
    }
}

export type <%= LanguageName %>Services = LangiumServices & <%= LanguageName %>AddedServices

export const <%= LanguageName %>Module: Module<<%= LanguageName %>Services, PartialLangiumServices & <%= LanguageName %>AddedServices> = {
    validation: {
        ValidationRegistry: (injector) => new <%= LanguageName %>ValidationRegistry(injector),
        <%= LanguageName %>Validator: () => new <%= LanguageName %>Validator()
    }
};

export function create<%= LanguageName %>Services(context?: DefaultModuleContext): <%= LanguageName %>Services {
    return inject(
        createDefaultModule(context),
        <%= LanguageName %>GeneratedModule,
        <%= LanguageName %>Module
    );
}
