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
 `;

const symbols = expectSymbols(createLangiumGrammarServices(), expectFunction);

describe('Document symbols', () => {

    test('Should show all document symbols', () => {
        symbols({
            text,
            expectedSymbols: [
                {
                    name: 'g',
                    kind: SymbolKind.Field,
                    range: Range.create(Position.create(0, 0), Position.create(4, 1)),
                    selectionRange: Range.create(Position.create(1, 9), Position.create(1, 10)),
                    children: [
                        {
                            name: 'X',
                            kind: SymbolKind.Field,
                            range: Range.create(Position.create(2, 1), Position.create(2, 13)),
                            selectionRange: Range.create(Position.create(2, 1), Position.create(2, 2))
                        },
                        {
                            name: 'hiddenTerminal',
                            kind: SymbolKind.Field,
                            range: Range.create(Position.create(3, 1), Position.create(3, 30)),
                            selectionRange: Range.create(Position.create(3, 10), Position.create(3, 24))
                        }
                    ]
                }
            ]
        });
    });
});
