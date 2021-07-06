/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, DefaultModuleContext, inject, LangiumServices, Module, PartialLangiumServices } from 'langium';
import { DomainModelGeneratedModule } from './generated/module';
import { DomainModelValidationRegistry, DomainModelValidator } from './domain-model-validator';
import { DomainModelScopeComputation } from './domain-model-scope';

export type DomainModelAddedServices = {
    validation: {
        DomainModelValidator: DomainModelValidator
    }
}

export type DomainModelServices = LangiumServices & DomainModelAddedServices

export const DomainModelModule: Module<DomainModelServices, PartialLangiumServices & DomainModelAddedServices> = {
    references: {
        ScopeComputation: (injector) => new DomainModelScopeComputation(injector)
    },
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
