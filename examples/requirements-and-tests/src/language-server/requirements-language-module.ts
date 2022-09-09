import { LangiumServices, Module, PartialLangiumServices } from 'langium';
import { RequirementsLanguageValidationRegistry, RequirementsLanguageValidator } from './requirements-language-validator';

/**
 * Declaration of custom services - add your own service classes here.
 */
 export type RequirementsLanguageAddedServices = {
    validation: {
        RequirementsLanguageValidator: RequirementsLanguageValidator
    }
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
 export type RequirementsLanguageServices = LangiumServices & RequirementsLanguageAddedServices

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
