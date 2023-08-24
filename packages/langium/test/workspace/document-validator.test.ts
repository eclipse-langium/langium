/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, ValidationChecks } from 'langium';
import { describe, expect, test } from 'vitest';
import { EmptyFileSystem, URI } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';

describe('DefaultDocumentValidator', () => {
    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    async function createServices() {
        const grammar = `
            grammar Test
            entry Model:
                foos+=Foo*;
            Foo:
                'foo' value=INT;
            terminal INT returns number: /[0-9]+/;
            hidden terminal WS: /\\s+/;
        `;
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
