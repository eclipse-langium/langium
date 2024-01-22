/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { LangiumConfig } from '../../src/package.js';
import { EmptyFileSystem, URI, type Grammar } from 'langium';
import { describe, expect, test } from 'vitest';
import { RelativePath } from '../../src/package.js';
import { serializeGrammar } from '../../src/generator/grammar-serializer.js';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expandToString } from 'langium/generate';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem);

describe('Grammar serializer', () => {
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

});
