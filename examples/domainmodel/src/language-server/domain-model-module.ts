/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumServices, Module, PartialLangiumServices, LangiumSharedServices, DefaultSharedModuleContext } from 'langium';
import { inject, createDefaultSharedModule, createDefaultModule } from 'langium';
import { DomainModelGeneratedModule, DomainModelGeneratedSharedModule } from './generated/module.js';
import { DomainModelValidator, registerValidationChecks } from './domain-model-validator.js';
import { DomainModelScopeComputation } from './domain-model-scope.js';
import { QualifiedNameProvider } from './domain-model-naming.js';
import { DomainModelFormatter } from './domain-model-formatter.js';
import { DomainModelRenameProvider } from './domain-model-rename-refactoring.js';

export type DomainModelAddedServices = {
    references: {
        QualifiedNameProvider: QualifiedNameProvider
    },
    validation: {
        DomainModelValidator: DomainModelValidator
    }
}

export type DomainModelServices = LangiumServices & DomainModelAddedServices

export const DomainModelModule: Module<DomainModelServices, PartialLangiumServices & DomainModelAddedServices> = {
    references: {
        ScopeComputation: (services) => new DomainModelScopeComputation(services),
        QualifiedNameProvider: () => new QualifiedNameProvider()
    },
    validation: {
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
    registerValidationChecks(domainmodel);
    return { shared, domainmodel };
}
