/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { DefaultSharedModuleContext, LangiumSharedServices } from 'langium';
import type { RequirementsLangServices } from './requirements-lang-module.js';
import type { TestsLangServices } from './tests-lang-module.js';
import { createDefaultModule, createDefaultSharedModule, inject } from 'langium';
import { RequirementsAndTestsGeneratedSharedModule, RequirementsGeneratedModule, TestsGeneratedModule } from './generated/module.js';
import { RequirementsLangModule } from './requirements-lang-module.js';
import { registerRequirementsValidationChecks } from './requirements-lang-validator.js';
import { TestsLangModule } from './tests-lang-module.js';
import { registerTestsValidationChecks } from './tests-lang-validator.js';

/**
 * Create the full set of services required by Langium.
 *
 * First inject the shared services by merging two modules:
 *  - Langium default shared services
 *  - Services generated by langium-cli
 *
 * Then inject the language-specific services by merging three modules:
 *  - Langium default language-specific services
 *  - Services generated by langium-cli
 *  - Services specified in this file
 *
 * @param context Optional module context with the LSP connection
 * @returns An object wrapping the shared services and the language-specific services
 */
export function createRequirementsAndTestsLangServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    requirements: RequirementsLangServices,
    tests: TestsLangServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        RequirementsAndTestsGeneratedSharedModule
    );
    const requirements = inject(
        createDefaultModule({ shared }),
        RequirementsGeneratedModule,
        RequirementsLangModule
    );
    const tests = inject(
        createDefaultModule({ shared }),
        TestsGeneratedModule,
        TestsLangModule
    );
    shared.ServiceRegistry.register(requirements);
    shared.ServiceRegistry.register(tests);
    registerRequirementsValidationChecks(requirements);
    registerTestsValidationChecks(tests);
    return { shared, requirements, tests };
}
