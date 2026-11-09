/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { expandToString } from 'langium/generate';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper, replaceIndices } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { type TypeHierarchyItem } from 'vscode-languageserver';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const typeHierarchyProvider = services.lsp.TypeHierarchyProvider!;
const parse = parseHelper(services);

describe('LangiumGrammarTypeHierarchyProvider', async () => {
    test('uses the declaration URI for a cross-file reference', async () => {
        const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
        const parseDocument = parseHelper(grammarServices);
        const base = await parseDocument('interface Root {}\ninterface Base extends Root {}', {
            documentUri: 'file:///base.langium'
        });
        const { output, indices } = replaceIndices({ text: expandToString`
            grammar Use
            import './base'
            entry Main: name='main';
            interface Child extends <|>Base {}
        ` });
        const use = await parseDocument(output, { documentUri: 'file:///use.langium' });
        const provider = grammarServices.lsp.TypeHierarchyProvider!;
        const items = await provider.prepareTypeHierarchy(use, {
            textDocument: { uri: use.uri.toString() },
            position: use.textDocument.positionAt(indices[0])
        });
        expect(items).toMatchObject([{ name: 'Base', uri: base.uri.toString() }]);
        const supertypes = await provider.supertypes({ item: items![0] });
        expect(supertypes).toMatchObject([{ name: 'Root', uri: base.uri.toString() }]);
    });

    describe('supertypes', () => {
        const testCases: TypeHierarchyProviderTest[] = [
            {
                testName: 'interface without supertypes',
                code: 'interface Decla<|>ration {}',
                expectedItems: undefined,
            },
            {
                testName: 'interface with single parent type',
                code: `
                    interface Declaration {}
                    interface Cla<|>ss extends Declaration {}
                `,
                expectedItems: [{ name: 'Declaration' }],
            },
            {
                testName: 'interface with multiple parent types',
                code: `
                    interface Callable {}
                    interface Declaration {}
                    interface Cla<|>ss extends Callable, Declaration {}
                `,
                expectedItems: [{ name: 'Callable' }, { name: 'Declaration' }],
            },
            {
                testName: 'not an interface',
                code: `
                    Para<|>meter:
                        name=ID;
                `,
                expectedItems: undefined,
            },
        ];

        test.each(testCases)('should list all supertypes ($testName)', async ({ code, expectedItems }) => {
            const result = await getActualSimpleSupertypes(code);
            expect(result).toStrictEqual(expectedItems);
        });
    });

    describe('subtypes', () => {
        const testCases: TypeHierarchyProviderTest[] = [
            {
                testName: 'interface without subtypes',
                code: 'interface Decla<|>ration {}',
                expectedItems: undefined,
            },
            {
                testName: 'interface without subtypes but with references',
                code: `
                    interface Decla<|>ration {}
                    
                    interface Reference {
                        declaration: @Declaration;
                    }
                `,
                expectedItems: undefined,
            },
            {
                testName: 'interface with subtypes',
                code: `
                    interface Decla<|>ration {}
                    interface Class extends Declaration {}
                    interface Enum extends Declaration {}
                `,
                expectedItems: [{ name: 'Class' }, { name: 'Enum' }],
            },
            {
                testName: 'not an interface',
                code: `
                    Para<|>meter:
                        name=ID;
                `,
                expectedItems: undefined,
            },
        ];

        test.each(testCases)('should list all subtypes ($testName)', async ({ code, expectedItems }) => {
            const result = await getActualSimpleSubtypes(code);
            expect(result).toStrictEqual(expectedItems);
        });
    });
});

const getActualSimpleSupertypes = async (code: string): Promise<SimpleTypeHierarchyItem[] | undefined> => {
    const supertypes = await typeHierarchyProvider.supertypes({ item: await getUniqueTypeHierarchyItem(code) });
    return supertypes?.map((type) => ({
        name: type.name,
    }));
};

const getActualSimpleSubtypes = async (code: string): Promise<SimpleTypeHierarchyItem[] | undefined> => {
    const supertypes = await typeHierarchyProvider.subtypes({ item: await getUniqueTypeHierarchyItem(code) });
    return supertypes?.map((type) => ({
        name: type.name,
    }));
};

const getUniqueTypeHierarchyItem = async (code: string): Promise<TypeHierarchyItem> => {
    const { output: input, indices } = replaceIndices({
        text: code
    });
    const document = await parse(input);

    // Get the position of the single index marker
    if (indices.length !== 1) {
        throw new Error(`Expected exactly one range, but got ${indices.length}.`);
    }
    const position = document.textDocument.positionAt(indices[0]);

    const items =
        await typeHierarchyProvider.prepareTypeHierarchy(document, {
            textDocument: {
                uri: document.textDocument.uri,
            },
            position,
        }) ?? [];

    if (items.length !== 1) {
        throw new Error(`Expected exactly one type hierarchy item, but got ${items.length}.`);
    }

    return items[0];
};

/**
 * A test case for {@link TypeHierarchyProvider.supertypes} and {@link TypeHierarchyProvider.subtypes}.
 */
interface TypeHierarchyProviderTest {
    /**
     * A short description of the test case.
     */
    testName: string;

    /**
     * The code to parse.
     */
    code: string;

    /**
     * The expected type hierarchy items.
     */
    expectedItems: SimpleTypeHierarchyItem[] | undefined;
}

/**
 * A simplified variant of {@link TypeHierarchyItem}.
 */
interface SimpleTypeHierarchyItem {
    /**
     * The name of the declaration.
     */
    name: string;
}
