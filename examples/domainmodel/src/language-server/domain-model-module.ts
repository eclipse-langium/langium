/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { type Module, inject } from 'langium';
import type { LangiumServices, LangiumSharedServices, PartialLangiumServices } from 'langium/lsp';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext } from 'langium/lsp';
import { DomainModelFormatter } from './domain-model-formatter.js';
import { QualifiedNameProvider } from './domain-model-naming.js';
import { DomainModelRenameProvider } from './domain-model-rename-refactoring.js';
import { DomainModelScopeComputation } from './domain-model-scope.js';
import { DomainModelValidator, registerValidationChecks } from './domain-model-validator.js';
import { DomainModelGeneratedModule, DomainModelGeneratedSharedModule } from './generated/module.js';

export type DomainModelAddedServices = {
    references: {
        QualifiedNameProvider: QualifiedNameProvider
    },
    validation: {
        DomainModelValidator: DomainModelValidator
    }
}

export type DomainModelServices = LangiumServices & DomainModelAddedServices;

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
    if (!context.connection) {
        // We don't run inside a language server
        // Therefore, initialize the configuration provider instantly
        shared.workspace.ConfigurationProvider.initialized({});
    }
    return { shared, domainmodel };
}
