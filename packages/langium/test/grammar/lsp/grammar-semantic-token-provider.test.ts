/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { highlightHelper, expectSemanticToken } from 'langium/test';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { SemanticTokenTypes } from 'vscode-languageserver';

const services = createLangiumGrammarServices(EmptyFileSystem);
const highlight = highlightHelper(services.grammar);

describe('Langium grammar semantic token provider', () => {
    test('should highlight primitive and referenced types as token type "type"', async () => {
        // arrange
        const grammarText = `grammar Test
        interface X {
            x: <|string|> | <|AbstractDefinition|>
        }
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectSemanticToken(tokens, {
            rangeIndex: 0,
            tokenType: SemanticTokenTypes.type,
        });
        expectSemanticToken(tokens, {
            rangeIndex: 1,
            tokenType: SemanticTokenTypes.type,
        });
    });

    test('should highlight assignment\'s feature as token type "property"', async () => {
        // arrange
        const grammarText = `grammar Test
        entry Main: <|name|>=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectSemanticToken(tokens, {
            tokenType: SemanticTokenTypes.property,
        });
    });

    test('should highlight action\'s feature as token type "property"', async () => {
        // arrange
        const grammarText = `grammar Test
        interface A {name: string; main: Main;}
        entry Main: {infer A.<|main|>=current} name=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectSemanticToken(tokens, {
            tokenType: SemanticTokenTypes.property,
        });
    });

    test('should highlight return type\'s name as token type "type"', async () => {
        // arrange
        const grammarText = `grammar Test
        entry Main: Num;
        terminal Num returns <|number|>: /[0-9]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectSemanticToken(tokens, {
            tokenType: SemanticTokenTypes.type,
        });
    });

    test('should highlight parameter\'s name and parameter reference\'s parameter as token type "parameter"', async () => {
        // arrange
        const grammarText = `grammar Test
        entry Main <<|abc|>>:
          <<|abc|>> name=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectSemanticToken(tokens, {
            rangeIndex: 0,
            tokenType: SemanticTokenTypes.parameter,
        });
        expectSemanticToken(tokens, {
            rangeIndex: 1,
            tokenType: SemanticTokenTypes.parameter,
        });
    });

});
