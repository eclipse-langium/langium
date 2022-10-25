/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src/grammar/langium-grammar-module';
import { expectGoToDeclaration } from '../../src/test/langium-test';
import { EmptyFileSystem } from '../../src/workspace/file-system-provider';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const gotoDeclaration = expectGoToDeclaration(grammarServices);

describe('Definition Provider', () => {
    test('Must find declaration from cross reference', async () => {
        const text = `grammar test hidden(WS)

        terminal ID: /\\w+/;
        terminal WS: /\\s+/;
        
        Model: value=<|>Entity;
        
        <|Entity|>: name=ID;
        `.trim();

        await gotoDeclaration({
            text,
            index:0,
            rangeIndex: 0
        });
    });

    test('Must find declaration in terminal', async () => {
        const text = `grammar test hidden(WS)

        terminal <|ID|>: /\\w+/;
        terminal WS: /\\s+/;
        
        Model: value=Entity;
        
        Entity: name=<|>ID;
        `.trim();

        await gotoDeclaration({
            text,
            index:0,
            rangeIndex: 0
        });
    });
});