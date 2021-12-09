/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Position, Range, SymbolKind } from 'vscode-languageserver';
import { createLangiumGrammarServices } from '../../src';
import { expectSymbols } from '../../src/test';
import { expectFunction } from '../fixture';

const text = `
 grammar g hidden(hiddenTerminal)
 X: name="X";
 terminal hiddenTerminal: /x/;
 `.trim();

const grammarServices = createLangiumGrammarServices().ServiceRegistry.all[0];
const symbols = expectSymbols(grammarServices, expectFunction);

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
                            selectionRange: Range.create(Position.create(1, 1), Position.create(1, 2))
                        },
                        {
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
