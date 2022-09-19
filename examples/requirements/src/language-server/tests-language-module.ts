import { LangiumServices, Module, PartialLangiumServices } from 'langium';
import { TestsLanguageValidationRegistry, TestsLanguageValidator } from './tests-language-validator';

/**
 * Declaration of custom services - add your own service classes here.
 */
export type TestsLanguageAddedServices = {
    validation: {
        TestsLanguageValidator: TestsLanguageValidator
    }
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
export type TestsLanguageServices = LangiumServices & TestsLanguageAddedServices

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
export const TestsLanguageModule: Module<TestsLanguageServices, PartialLangiumServices & TestsLanguageAddedServices> = {
    validation: {
        ValidationRegistry: (services) => new TestsLanguageValidationRegistry(services),
        TestsLanguageValidator: () => new TestsLanguageValidator()
    }
};