import type { ValidationChecks } from 'langium';
import type { <%= LanguageName %>AstType } from './generated/ast.js';
import type { <%= LanguageName %>Services } from './<%= language-id %>-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: <%= LanguageName %>Services) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.<%= LanguageName %>Validator;
    const checks: ValidationChecks<<%= LanguageName %>AstType> = {
        // TODO: Declare validators for your properties
        // See doc : https://langium.org/docs/learn/workflow/create_validations/
        /*
        Element: validator.checkElement
        */
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class <%= LanguageName %>Validator {

    // TODO: Add logic here for validation checks of properties
    // See doc : https://langium.org/docs/learn/workflow/create_validations/
    /*
    checkElement(element: Element, accept: ValidationAcceptor): void {
        // Always accepts
    }
    */
}
