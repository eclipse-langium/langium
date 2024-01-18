/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { LangiumCoreServices } from 'langium';
import { describe, expect, test } from 'vitest';
import { DefaultServiceRegistry, URI } from 'langium';

describe('DefaultServiceRegistry', () => {

    test('should work with a single language', () => {
        const language: LangiumCoreServices = { foo: 'bar' } as any;
        const registry = new DefaultServiceRegistry();
        registry.register(language);
        expect(registry.getServices(URI.parse('file:/foo.bar'))).toBe(language);
        expect(registry.all).toHaveLength(1);
    });

    test('should work with two languages', () => {
        const language1: LangiumCoreServices = { LanguageMetaData: { fileExtensions: ['.foo'] } } as any;
        const language2: LangiumCoreServices = { LanguageMetaData: { fileExtensions: ['.bar'] } } as any;
        const registry = new DefaultServiceRegistry();
        registry.register(language1);
        registry.register(language2);
        expect(registry.getServices(URI.parse('file:/test.foo'))).toBe(language1);
        expect(registry.getServices(URI.parse('file:/test.bar'))).toBe(language2);
        expect(registry.all).toHaveLength(2);
    });

});
