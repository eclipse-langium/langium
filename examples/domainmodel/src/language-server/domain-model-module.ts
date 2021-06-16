import { createDefaultModule, DefaultModuleContext, inject, LangiumServices, Module, PartialLangiumServices } from 'langium';
import { DomainModelGeneratedModule } from './generated/module';
import { DomainModelValidationRegistry, DomainModelValidator } from './domain-model-validator';

export type DomainModelAddedServices = {
    validation: {
        DomainModelValidator: DomainModelValidator
    }
}

export type DomainModelServices = LangiumServices & DomainModelAddedServices

export const DomainModelModule: Module<DomainModelServices, PartialLangiumServices & DomainModelAddedServices> = {
    validation: {
        ValidationRegistry: (injector) => new DomainModelValidationRegistry(injector),
        DomainModelValidator: () => new DomainModelValidator()
    }
};

export function createDomainModelServices(context?: DefaultModuleContext): DomainModelServices {
    return inject(
        createDefaultModule(context),
        DomainModelGeneratedModule,
        DomainModelModule
    );
}
