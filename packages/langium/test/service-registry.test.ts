/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { LangiumCoreServices, LangiumSharedCoreServices, Module, PartialLangiumSharedCoreServices, TextDocumentProvider } from 'langium';
import { describe, expect, test } from 'vitest';
import { DefaultServiceRegistry, EmptyFileSystem, URI, createDefaultSharedCoreModule, inject, TextDocument } from 'langium';

describe('DefaultServiceRegistry', () => {

    test('should work with a single language', () => {
        const language: LangiumCoreServices = { LanguageMetaData: { fileExtensions: ['.foo'], languageId: 'foo' } } as any;
        const registry = new DefaultServiceRegistry(createSharedCoreServices());
        registry.register(language);
        expect(registry.getServices(URI.parse('file:/foo.bar'))).toBe(language);
        expect(registry.all).toHaveLength(1);
    });

    test('should work with two languages', () => {
        const language1: LangiumCoreServices = { LanguageMetaData: { fileExtensions: ['.foo'], languageId: 'foo' } } as any;
        const language2: LangiumCoreServices = { LanguageMetaData: { fileExtensions: ['.bar'], languageId: 'bar' } } as any;
        const registry = new DefaultServiceRegistry(createSharedCoreServices());
        registry.register(language1);
        registry.register(language2);
        expect(registry.getServices(URI.parse('file:/test.foo'))).toBe(language1);
        expect(registry.getServices(URI.parse('file:/test.bar'))).toBe(language2);
        expect(registry.all).toHaveLength(2);
    });

    test('should work based on language ids', () => {
        const language1: LangiumCoreServices = { LanguageMetaData: { fileExtensions: [], languageId: 'foo' } } as any;
        const language2: LangiumCoreServices = { LanguageMetaData: { fileExtensions: [], languageId: 'bar' } } as any;
        const registry = new DefaultServiceRegistry(createSharedCoreServices('bar'));
        registry.register(language1);
        registry.register(language2);
        expect(registry.getServices(URI.parse('file:/test.x'))).toBe(language2);
        expect(registry.getServices(URI.parse('file:/test.y'))).toBe(language2);
        expect(registry.all).toHaveLength(2);
    });

    function createSharedCoreServices(id?: string): LangiumSharedCoreServices {
        const textDocumentsModule: Module<LangiumSharedCoreServices, PartialLangiumSharedCoreServices> = {
            workspace: {
                TextDocuments: (id ? (() => createTextDocuments(id)) : undefined)
            }
        };
        return inject(createDefaultSharedCoreModule(EmptyFileSystem), textDocumentsModule);
    }

    function createTextDocuments(id: string): TextDocumentProvider {
        return {
            get(uri: string): TextDocument | undefined {
                return TextDocument.create(uri, id, 0, '');
            }
        };
    }

});
