import {
    createDefaultModule, createDefaultSharedModule, DefaultSharedModuleContext, inject,
    LangiumServices, LangiumSharedServices, Module, PartialLangiumServices
} from 'langium';
import { RequirementsAndTestsGeneratedSharedModule, RequirementsGeneratedModule, TestsGeneratedModule } from './generated/module';
import { RequirementsLanguageValidationRegistry, RequirementsLanguageValidator, TestsLanguageValidationRegistry, TestsLanguageValidator } from './requirements-and-tests-language-validator';

/**
 * Declaration of custom services - add your own service classes here.
 */
 export type RequirementsLanguageAddedServices = {
    validation: {
        RequirementsLanguageValidator: RequirementsLanguageValidator
    }
}
export type TestsLanguageAddedServices = {
    validation: {
        TestsLanguageValidator: TestsLanguageValidator
    }
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
 export type RequirementsLanguageServices = LangiumServices & RequirementsLanguageAddedServices
 export type TestsLanguageServices = LangiumServices & TestsLanguageAddedServices

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
 export const RequirementsLanguageModule: Module<RequirementsLanguageServices, PartialLangiumServices & RequirementsLanguageAddedServices> = {
    validation: {
        ValidationRegistry: (services) => new RequirementsLanguageValidationRegistry(services),
        RequirementsLanguageValidator: () => new RequirementsLanguageValidator()
    }
};

export const TestsLanguageModule: Module<TestsLanguageServices, PartialLangiumServices & TestsLanguageAddedServices> = {
    validation: {
        ValidationRegistry: (services) => new TestsLanguageValidationRegistry(services),
        TestsLanguageValidator: () => new TestsLanguageValidator()
    }
};

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
export function createRequirementsAndTestsLanguageServices(context?: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    RequirementsLanguage: RequirementsLanguageServices,
    TestsLanguage: TestsLanguageServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        RequirementsAndTestsGeneratedSharedModule
    );
    const RequirementsLanguage = inject(
        createDefaultModule({ shared }),
        RequirementsGeneratedModule,
        RequirementsLanguageModule
    );
    const TestsLanguage = inject(
        createDefaultModule({ shared }),
        TestsGeneratedModule,
        TestsLanguageModule
    );
    shared.ServiceRegistry.register(RequirementsLanguage);
    shared.ServiceRegistry.register(TestsLanguage);
    return { shared, RequirementsLanguage, TestsLanguage };
}
