/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createLangiumGrammarServices } from '../../src';
import { expectDocumentHighlights } from '../../src/test';

const grammarServices = createLangiumGrammarServices().grammar;
const findHighlights = expectDocumentHighlights(grammarServices);

describe('findHighlights', () => {
    test('Must highlight occurrences of parser rule name in assignments', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;
        
        entry EntryRule: value=<|Ru<|>leA|>;
        
        <|Ru<|>leA|>: name=ID;

        RuleB: foo=<|Ru<|>leA|>
        `;

        await findHighlights({
            text: grammar
        });
    });

    test('Must highlight terminal in assignments', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal <|I<|>D|>: /\\w+/;
            
        RuleA: name=<|I<|>D|>;
        `;

        await findHighlights({
            text: grammar
        });
    });

    test('Must highlight interface name in type, return types, and actions', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;
        
        interface <|<|>A|> {
            name: string
        }

        type B = <|<|>A|>;

        RuleA returns <|<|>A|>: name=ID;

        ActionRule: {<|<|>A|>} name=ID;
        `;

        await findHighlights({
            text: grammar
        });
    });

    test('Must highlight occurrences of property in parser rule returning target type', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;
        
        interface A {
            <|na<|>me|>: string
        }

        RuleA returns A: <|na<|>me|>=ID;

        RuleB : name=ID;

        ActionRule: {A} <|na<|>me|>=ID;
        `;

        await findHighlights({
            text: grammar
        });
    });

    test('Must highlight occurrences of property in rules returning children types', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;
        
        interface A {
            <|na<|>me|>: string
        }

        interface B extends A {}

        type C = A;

        RuleA returns A: <|na<|>me|>=ID;

        RuleB returns B: <|na<|>me|>=ID;

        RuleC returns C: <|na<|>me|>=ID;

        ActionRule: {A} 'A' <|na<|>me|>=ID | {B} 'B' <|na<|>me|>=ID | {C} 'C' <|na<|>me|>=ID;
        `;

        await findHighlights({
            text: grammar
        });
    });
});