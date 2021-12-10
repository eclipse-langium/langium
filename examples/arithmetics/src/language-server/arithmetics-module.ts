/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createSharedModule, injectService, LangiumServices, LangiumSharedServices, Module, PartialLangiumServices, SharedModuleContext } from 'langium';
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

export function createArithmeticsServices(context?: SharedModuleContext): LangiumSharedServices {
    return injectService(
        createSharedModule(context),
        ArithmeticsGeneratedSharedModule,
        {
            generated: ArithmeticsGeneratedModule,
            module: ArithmeticsModule
        }
    );
}
