/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { URI } from 'vscode-uri';
import { DefaultServiceRegistry } from '../src/service-registry';
import { LangiumServices } from '../src/services';

describe('DefaultServiceRegistry', () => {

    test('should work with a single language', () => {
        const language: LangiumServices = { foo: 'bar' } as any;
        const registry = new DefaultServiceRegistry();
        registry.register(language);
        expect(registry.getServices(URI.parse('file:/foo.bar'))).toBe(language);
        expect(registry.all).toHaveLength(1);
    });

    test('should work with two languages', () => {
        const language1: LangiumServices = { LanguageMetaData: { fileExtensions: ['.foo'] } } as any;
        const language2: LangiumServices = { LanguageMetaData: { fileExtensions: ['.bar'] } } as any;
        const registry = new DefaultServiceRegistry();
        registry.register(language1);
        registry.register(language2);
        expect(registry.getServices(URI.parse('file:/test.foo'))).toBe(language1);
        expect(registry.getServices(URI.parse('file:/test.bar'))).toBe(language2);
        expect(registry.all).toHaveLength(2);
    });

});
