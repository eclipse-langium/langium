/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, DefaultModuleContext, inject, LangiumServices, Module, PartialLangiumServices } from 'langium';
import { ArithmeticsGeneratedModule } from './generated/module';
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

export function createArithmeticsServices(context?: DefaultModuleContext): ArithmeticsServices {
    return inject(
        createDefaultModule(context),
        ArithmeticsGeneratedModule,
        ArithmeticsModule
    );
}
