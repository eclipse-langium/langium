/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, DefaultSharedModuleContext, inject, LangiumServices, LangiumSharedServices, Module, PartialLangiumServices } from 'langium';
import { ArithmeticsGeneratedModule, ArithmeticsGeneratedSharedModule } from './generated/module';
import { ArithmeticsValidationRegistry, ArithmeticsValidator } from './arithmetics-validator';

export type ArithmeticsAddedServices = {
    validation: {
        ArithmeticsValidator: ArithmeticsValidator
    }
}

export type ArithmeticsServices = LangiumServices & ArithmeticsAddedServices

export const ArithmeticsModule: Module<ArithmeticsServices, PartialLangiumServices & ArithmeticsAddedServices> = {
    validation: {
        ValidationRegistry: (injector) => new ArithmeticsValidationRegistry(injector),
        ArithmeticsValidator: () => new ArithmeticsValidator()
    }
};

export function createArithmeticsServices(context?: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    arithmetics: ArithmeticsServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        ArithmeticsGeneratedSharedModule
    );
    const arithmetics = inject(
        createDefaultModule({ shared }),
        ArithmeticsGeneratedModule,
        ArithmeticsModule
    );
    shared.ServiceRegistry.register(arithmetics);
    return { shared, arithmetics };
}
