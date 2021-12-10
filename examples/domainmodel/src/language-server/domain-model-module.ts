/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createSharedModule, LangiumServices, Module, PartialLangiumServices, injectService, SharedModuleContext, LangiumSharedServices } from 'langium';
import { DomainModelGeneratedModule, DomainModelGeneratedSharedModule } from './generated/module';
import { DomainModelValidationRegistry, DomainModelValidator } from './domain-model-validator';
import { DomainModelScopeComputation } from './domain-model-scope';
import { DomainModelDescriptionProvider } from './domain-model-index';
import { DomainModelNameProvider } from './domain-model-naming';

export type DomainModelAddedServices = {
    validation: {
        DomainModelValidator: DomainModelValidator
    }
}

export type DomainModelServices = LangiumServices & DomainModelAddedServices

export const DomainModelModule: Module<DomainModelServices, PartialLangiumServices & DomainModelAddedServices> = {
    references: {
        ScopeComputation: (injector) => new DomainModelScopeComputation(injector),
        NameProvider: () => new DomainModelNameProvider()
    },
    validation: {
        ValidationRegistry: (injector) => new DomainModelValidationRegistry(injector),
        DomainModelValidator: () => new DomainModelValidator()
    },
    index: {
        AstNodeDescriptionProvider: (injector) => new DomainModelDescriptionProvider(injector)
    }
};

export function createDomainModelServices(context?: SharedModuleContext): LangiumSharedServices {
    return injectService(
        createSharedModule(context),
        DomainModelGeneratedSharedModule,
        {
            generated: DomainModelGeneratedModule,
            module: DomainModelModule
        }
    );
}
