/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumConfig } from '../../src/package-types.js';
import { EmptyFileSystem, URI, type Grammar } from 'langium';
import { afterEach, describe, expect, test } from 'vitest';
import { RelativePath } from '../../src/package-types.js';
import { serializeGrammar } from '../../src/generator/grammar-serializer.js';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expandToString } from 'langium/generate';
import { clearDocuments } from 'langium/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem);

describe('Grammar serializer', () => {

    afterEach(() => {
        clearDocuments(grammarServices.shared);
    });

    test('should include comments of AST elements', async () => {
        // arrange
        const config: LangiumConfig = {
            projectName: 'Magic',
            languages: [],
            [RelativePath]: '/path/to/magic',
        };

        const grammarText = expandToString`
        grammar Test

        /**
         * This is the entry rule
         */
        entry Model: /** This is the name assignment */ name='test';
        `;

        const document = grammarServices.shared.workspace.LangiumDocumentFactory.fromString<Grammar>(grammarText, URI.file('test.langium'));
        grammarServices.shared.workspace.LangiumDocuments.addDocument(document);
        await grammarServices.shared.workspace.DocumentBuilder.build([document]);
        const grammar = document.parseResult.value;

        // act
        const moduleString = serializeGrammar(grammarServices.grammar, [grammar], config);

        // assert
        expect(moduleString).toMatch('"$comment": "/** This is the name assignment */"');
        expect(moduleString).toMatch('"$comment": "/**\\\\n * This is the entry rule\\\\n */"');
    });

    test('should escape template strings in development mode', async () => {
        // arrange
        const config: LangiumConfig = {
            projectName: 'Magic',
            languages: [],
            mode: 'development',
            [RelativePath]: '/path/to/magic',
        };

        const grammarText = expandToString`
        grammar Test
        entry Model: template='\${' backtick='\`' single="'";
        `;

        const document = grammarServices.shared.workspace.LangiumDocumentFactory.fromString<Grammar>(grammarText, URI.file('test.langium'));
        grammarServices.shared.workspace.LangiumDocuments.addDocument(document);
        await grammarServices.shared.workspace.DocumentBuilder.build([document]);
        const grammar = document.parseResult.value;

        // act
        const moduleString = serializeGrammar(grammarServices.grammar, [grammar], config);

        // assert
        // Escapes `${` sequence correctly
        expect(moduleString).toMatch('"value": "\\${"');
        // Escapes the "`" character correctly
        expect(moduleString).toMatch('"value": "\\`');
        // Does not escape single quotes
        expect(moduleString).toMatch('"value": "\'"');
    });

    test('should escape single quotes in production mode', async () => {
        // arrange
        const config: LangiumConfig = {
            projectName: 'Magic',
            languages: [],
            mode: 'production',
            [RelativePath]: '/path/to/magic',
        };

        const grammarText = expandToString`
        grammar Test
        entry Model: single="'" backtick='\`';
        `;

        const document = grammarServices.shared.workspace.LangiumDocumentFactory.fromString<Grammar>(grammarText, URI.file('test.langium'));
        grammarServices.shared.workspace.LangiumDocuments.addDocument(document);
        await grammarServices.shared.workspace.DocumentBuilder.build([document]);
        const grammar = document.parseResult.value;

        // act
        const moduleString = serializeGrammar(grammarServices.grammar, [grammar], config);

        // assert
        // Escapes single quote character correctly
        expect(moduleString).toMatch('"value":"\\\'"');
        // Does not escape backticks
        expect(moduleString).toMatch('"value":"`"');
    });

});
