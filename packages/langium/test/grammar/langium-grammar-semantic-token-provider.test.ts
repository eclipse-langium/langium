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
});