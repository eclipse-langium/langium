/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Module } from 'langium';
import type { LangiumServices, PartialLangiumServices } from 'langium/lsp';
import { RequirementsLangValidator } from './requirements-lang-validator.js';

/**
 * Declaration of custom services - add your own service classes here.
 */
export type RequirementsLangAddedServices = {
    validation: {
        RequirementsLangValidator: RequirementsLangValidator
    }
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
export type RequirementsLangServices = LangiumServices & RequirementsLangAddedServices

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
export const RequirementsLangModule: Module<RequirementsLangServices, PartialLangiumServices & RequirementsLangAddedServices> = {
    validation: {
        RequirementsLangValidator: (services) => new RequirementsLangValidator(services)
    }
};

