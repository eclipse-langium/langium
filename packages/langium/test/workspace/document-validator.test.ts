/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, LangiumCoreServices, Module, PartialLangiumCoreServices, ValidateSingleNodeOptions, ValidationChecks, ValidationOptions } from 'langium';
import { describe, expect, test } from 'vitest';
import { DefaultDocumentValidator, EmptyFileSystem, URI } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';

const grammar = `
    grammar Test
    entry Model:
        foos+=Foo*;
    Foo:
        'foo' value=INT;
    terminal INT returns number: /[0-9]+/;
    hidden terminal WS: /\\s+/;
`;

describe('DefaultDocumentValidator', () => {
    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    async function createServices() {
        const services = await createServicesForGrammar({ grammar, grammarServices });
        const checks: ValidationChecks<TestAstType> = {
            Foo: (node, accept) => {
                if (node.value > 10) {
                    accept('warning', 'Value is too large: ' + node.value, { node });
                }
            }
        };
        services.validation.ValidationRegistry.register(checks);
        return services;
    }

    test('validates with lexing error', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
            foo 11
            foo bar 2
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.map(d => d.message)).toEqual([
            'unexpected character: ->b<- at offset: 54, skipped 3 characters.',
            'Value is too large: 11'
        ]);
    });

    test('validates with parsing error', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
            foo 11
            foo foo 2
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.map(d => d.message)).toEqual([
            'Expecting token of type \'INT\' but found `foo`.',
            'Value is too large: 11'
        ]);
    });

    test('stops validating after lexing error if requested', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
            foo 11
            foo bar 2
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document, {
            stopAfterLexingErrors: true
        });
        expect(diagnostics.map(d => d.message)).toEqual([
            'unexpected character: ->b<- at offset: 54, skipped 3 characters.'
        ]);
    });

    test('stops validating after parsing error if requested', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
            foo 11
            foo foo 2
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document, {
            stopAfterParsingErrors: true
        });
        expect(diagnostics.map(d => d.message)).toEqual([
            'Expecting token of type \'INT\' but found `foo`.'
        ]);
    });

});

describe('Customized DefaultDocumentValidator to ignore some nodes during validation', () => {
    async function createServices() {
        const services = await createServicesForGrammar({ grammar, module: <Module<LangiumCoreServices, PartialLangiumCoreServices>>{
            validation: {
                DocumentValidator: (services) => new CustomizedDefaultDocumentValidator(services),
            },
        }, });
        const checks: ValidationChecks<TestAstType> = {
            Model: (node, accept) => {
                accept('warning', `Model has ${node.foos.length} children.`, { node });
            },
            Foo: (node, accept) => {
                accept('warning', 'Value ' + node.value, { node });
            }
        };
        services.validation.ValidationRegistry.register(checks);
        return services;
    }

    class CustomizedDefaultDocumentValidator extends DefaultDocumentValidator {
        protected override validateSingleNodeOptions(node: AstNode, _options: ValidationOptions): ValidateSingleNodeOptions {
            return {
                validateNode: node.$type !== 'Model' || (node as Model).foos.length <= 1, // all Foo, only Model's with at maximum one child
                validateChildren: node.$type !== 'Model' || (node as Model).foos.length <= 2, // all Foo (which have never children), only Model's with at maximum two children
            };
        }
    }

    test('Three children => no validations at all', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
            foo 2
            foo 3
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.map(d => d.message)).toEqual([]);
    });

    test('Two children => validate only the children', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
            foo 2
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.map(d => d.message)).toEqual(['Value 1', 'Value 2']);
    });

    test('One child => validate the child and the root Model', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
            foo 1
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.map(d => d.message)).toEqual(['Model has 1 children.', 'Value 1']);
    });

    test('No child => validate the root Model', async () => {
        const services = await createServices();
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(`
        `, URI.parse('file:///test.txt'));
        const diagnostics = await services.validation.DocumentValidator.validateDocument(document);
        expect(diagnostics.map(d => d.message)).toEqual(['Model has 0 children.']);
    });

});

type TestAstType = {
    Model: Model
    Foo: Foo
}

interface Model extends AstNode {
    foos: Foo[]
}

interface Foo extends AstNode {
    value: number
}
