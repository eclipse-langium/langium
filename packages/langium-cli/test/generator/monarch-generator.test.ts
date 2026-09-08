/**
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 */

import { EmptyFileSystem, URI, type Grammar } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { clearDocuments } from 'langium/test';
import { afterEach, describe, expect, test } from 'vitest';
import { generateMonarch } from '../../src/generator/highlighting/monarch-generator.js';

const services = createLangiumGrammarServices(EmptyFileSystem);

describe('Monarch generator', () => {
    afterEach(() => clearDocuments(services.shared));

    test('emits case-insensitive matching and escaped language strings', async () => {
        const document = services.shared.workspace.LangiumDocumentFactory.fromString<Grammar>(
            `grammar Test

entry Model: '\\\\' | "'";`,
            URI.file('test.langium')
        );
        services.shared.workspace.LangiumDocuments.addDocument(document);
        await services.shared.workspace.DocumentBuilder.build([document]);

        const output = generateMonarch(document.parseResult.value, {
            id: 'test',
            grammar: 'test.langium',
            caseInsensitive: true
        });

        expect(output).toContain('ignoreCase: true');
        expect(output).toContain("'\\\\'");
        expect(output).toContain("'\\''");
    });
});
