/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices, Module, PartialLangiumServices, LangiumSharedServices, DefaultSharedModuleContext, inject, createDefaultSharedModule, createDefaultModule } from 'langium';
import { DomainModelGeneratedModule, DomainModelGeneratedSharedModule } from './generated/module';
import { DomainModelValidationRegistry, DomainModelValidator } from './domain-model-validator';
import { DomainModelScopeComputation } from './domain-model-scope';
import { DomainModelNameProvider } from './domain-model-naming';
import { DomainModelFormatter } from './domain-model-formatter';
import { DomainModelRenameProvider } from './domain-model-rename-refactoring';

export type DomainModelAddedServices = {
    validation: {
        DomainModelValidator: DomainModelValidator
    }
}

export type DomainModelServices = LangiumServices & DomainModelAddedServices

export const DomainModelModule: Module<DomainModelServices, PartialLangiumServices & DomainModelAddedServices> = {
    references: {
        ScopeComputation: (services) => new DomainModelScopeComputation(services),
        NameProvider: () => new DomainModelNameProvider()
    },
    validation: {
        ValidationRegistry: (services) => new DomainModelValidationRegistry(services),
        DomainModelValidator: () => new DomainModelValidator()
    },
    lsp: {
        Formatter: () => new DomainModelFormatter(),
        RenameProvider: (services) => new DomainModelRenameProvider(services)
    }
};

export function createDomainModelServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    domainmodel: DomainModelServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        DomainModelGeneratedSharedModule
    );
    const domainmodel = inject(
        createDefaultModule({ shared }),
        DomainModelGeneratedModule,
        DomainModelModule
    );
    shared.ServiceRegistry.register(domainmodel);
    return { shared, domainmodel };
}
