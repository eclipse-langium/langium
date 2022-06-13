/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { highlightHelper, expectToken } from '../../src/test/langium-test';
import { createLangiumGrammarServices } from '../../src';
import { SemanticTokenTypes } from 'vscode-languageserver';

const services = createLangiumGrammarServices();
const highlight = highlightHelper(services.grammar);

describe('Langium grammar semantic token provider', () => {
    test('should highlight primitive and referenced types as token type "type"', async () => {
        // arrange
        const grammarText = `grammar Test
        interface X {
            x: string | AbstractDefinition
        }
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectToken(tokens, {
            text: 'string',
            tokenType: SemanticTokenTypes.type,
            line: 2
        });
        expectToken(tokens, {
            text: 'AbstractDefinition',
            tokenType: SemanticTokenTypes.type,
            line: 2
        });
    });

    test('should highlight assignment\'s feature as token type "property"', async () => {
        // arrange
        const grammarText = `grammar Test
        entry Main: name=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectToken(tokens, {
            text: 'name',
            tokenType: SemanticTokenTypes.property,
            line: 1
        });
    });

    test('should highlight action\'s feature as token type "property"', async () => {
        // arrange
        const grammarText = `grammar Test
        interface A {name: string; main: Main;}
        entry Main: {infer A.main=current} name=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectToken(tokens, {
            text: 'main',
            tokenType: SemanticTokenTypes.property,
            line: 2
        });
    });

    test.skip('should highlight return type\'s name as token type "type"', async () => {
        // arrange
        const grammarText = `grammar Test
        interface A {name: string;}
        entry Main returns A: name=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectToken(tokens, {
            text: 'A',
            tokenType: SemanticTokenTypes.type,
            line: 2
        });
    });

    test('should highlight parameter\'s name and parameter reference\'s parameter as token type "parameter"', async () => {
        // arrange
        const grammarText = `grammar Test
        entry Main <abc>: 
          <abc> name=ID;
        terminal ID: /[a-z]+/;
        `.trim();

        // act
        const tokens = await highlight(grammarText);

        // assert
        expectToken(tokens, {
            text: 'abc',
            tokenType: SemanticTokenTypes.parameter,
            line: 1
        });
        expectToken(tokens, {
            text: 'abc',
            tokenType: SemanticTokenTypes.parameter,
            line: 2
        });
    });
});