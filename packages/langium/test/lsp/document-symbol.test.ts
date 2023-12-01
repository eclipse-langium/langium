/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { Position, Range, SymbolKind } from 'vscode-languageserver';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectSymbols } from 'langium/test';

const text = `
 grammar g hidden(hiddenTerminal)
 X: name="X";
 terminal hiddenTerminal: /x/;
 `.trim();

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const symbols = expectSymbols(grammarServices);

describe('Document symbols', () => {

    test('Should show all document symbols', async () => {
        await symbols({
            text,
            expectedSymbols: [
                {
                    name: 'g',
                    kind: SymbolKind.Field,
                    range: Range.create(Position.create(0, 0), Position.create(2, 30)),
                    selectionRange: Range.create(Position.create(0, 8), Position.create(0, 9)),
                    children: [
                        {
                            name: 'X',
                            kind: SymbolKind.Field,
                            range: Range.create(Position.create(1, 1), Position.create(1, 13)),
                            selectionRange: Range.create(Position.create(1, 1), Position.create(1, 2)),
                            children: [{
                                children: undefined,
                                kind: SymbolKind.Field,
                                name: 'name',
                                range: Range.create(Position.create(1, 4), Position.create(1, 12)),
                                selectionRange: Range.create(Position.create(1, 4), Position.create(1, 8))
                            }]
                        },
                        {
                            children: undefined,
                            name: 'hiddenTerminal',
                            kind: SymbolKind.Field,
                            range: Range.create(Position.create(2, 1), Position.create(2, 30)),
                            selectionRange: Range.create(Position.create(2, 10), Position.create(2, 24))
                        }
                    ]
                }
            ]
        });
    });
});

