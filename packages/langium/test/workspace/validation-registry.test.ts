/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumGrammarAstType } from '../../src/grammar/generated/ast.js';
import type { ValidationChecks } from '../../src/validation/validation-registry.js';
import type { LangiumServices } from '../../src/services.js';
import { describe, expect, test } from 'vitest';
import { LangiumGrammarAstReflection } from '../../src/grammar/generated/ast.js';
import { ValidationRegistry } from '../../src/validation/validation-registry.js';

describe('ValidationRegistry', () => {
    function createRegistry(): ValidationRegistry {
        // Create a minimal set of services so we can start with an empty registry
        const services = {
            shared: {
                AstReflection: new LangiumGrammarAstReflection()
            }
        } as unknown as LangiumServices;
        return new ValidationRegistry(services);
    }

    test('registers array of checks', () => {
        const appliedChecks: string[] = [];
        const registry = createRegistry();
        const checks: ValidationChecks<LangiumGrammarAstType> = {
            ParserRule: [
                () => { appliedChecks.push('a'); },
                () => { appliedChecks.push('b'); }
            ]
        };
        registry.register(checks);
        registry.getChecks('ParserRule').forEach(check => (check as () => void)());
        expect(appliedChecks).toEqual(['a', 'b']);
    });

    test('registers check with proper `this`', () => {
        const appliedChecks: string[] = [];
        const registry = createRegistry();
        class Validations {
            foo = 'bar';
            check(): void {
                appliedChecks.push(this.foo);
            }
        }
        const validations = new Validations();
        const checks: ValidationChecks<LangiumGrammarAstType> = {
            ParserRule: validations.check
        };
        registry.register(checks, validations);
        registry.getChecks('ParserRule').forEach(check => (check as () => void)());
        expect(appliedChecks).toEqual(['bar']);
    });

    test("uses 'fast' as default category", () => {
        const appliedChecks: string[] = [];
        const registry = createRegistry();
        const checks1: ValidationChecks<LangiumGrammarAstType> = {
            ParserRule: () => { appliedChecks.push('a'); }
        };
        registry.register(checks1);
        const checks2: ValidationChecks<LangiumGrammarAstType> = {
            ParserRule: () => { appliedChecks.push('b'); }
        };
        registry.register(checks2, undefined, 'fast');
        registry.getChecks('ParserRule', ['fast']).forEach(check => (check as () => void)());
        expect(appliedChecks).toEqual(['a', 'b']);
    });

    test("gives only 'slow' checks when requested", () => {
        const appliedChecks: string[] = [];
        const registry = createRegistry();
        const checks1: ValidationChecks<LangiumGrammarAstType> = {
            ParserRule: () => { appliedChecks.push('a'); }
        };
        registry.register(checks1, undefined, 'fast');
        const checks2: ValidationChecks<LangiumGrammarAstType> = {
            ParserRule: () => { appliedChecks.push('b'); }
        };
        registry.register(checks2, undefined, 'slow');
        registry.getChecks('ParserRule', ['slow']).forEach(check => (check as () => void)());
        expect(appliedChecks).toEqual(['b']);
    });

});
