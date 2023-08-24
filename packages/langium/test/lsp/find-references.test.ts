/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { expectFindReferences } from 'langium/test';

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const findReferences = expectFindReferences(grammarServices);

describe('findReferences', () => {
    test('Must find references to parent interface in another interface declaration. Including parent interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|<|>A|> {
            name: string
        }

        interface B extends <|<|>A|> {}
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to parent interface in another interface declaration. Excluding parent interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|>A {
            name: string
        }

        interface B extends <|A|> {}
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: false
        });
    });

    test('Must find references to interface in parser rules. Including interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|<|>A|> {
            name: string
        }

        ruleA returns <|<|>A|>: name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to interface in parser rules. Excluding interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|>A {
            name: string
        }

        ruleA returns <|A|>: name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: false
        });
    });

    test('Must find references to interface in actions. Including interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|<|>A|> {
            name: string
        }

        ActionRule: {<|<|>A|>} name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to interface in actions. Excluding interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|>A {
            name: string
        }

        ActionRule: {<|A|>} name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: false
        });
    });

    test('Must find references to interface in union types. Including interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|<|>A|> {
            name: string
        }

        interface B {
            foo:string
        }

        type C = <|<|>A|> | B;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to interface in union types. Excluding interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|>A {
            name: string
        }

        interface B {
            foo:string
        }

        type C = <|A|> | B;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: false
        });
    });

    test('Must find references to interface in children interfaces, parser rules, actions, and union types. Including parent interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|<|>A|> {
            name: string
        }

        interface B extends <|<|>A|> {}

        type C = <|<|>A|> | B;

        RuleA returns <|<|>A|>: name=ID;

        ActionRule: {<|<|>A|>} name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to interface in children interfaces, parser rules, actions, and union types. Excluding interface declaration', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface <|>A {
            name: string
        }

        interface B extends <|<|>A|> {}

        type C = <|<|>A|> | B;

        RuleA returns <|<|>A|>: name=ID;

        ActionRule: {<|<|>A|>} name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: false
        });
    });

    test('Must find references to a property assigned in parser rule', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|na<|>me|>: string
        }

        RuleA returns A: <|na<|>me|>=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to a property assigned in parser rule returning child type', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|na<|>me|>: string
        }

        interface B extends A {}

        RuleB returns B: <|na<|>me|>=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to a property assigned in parser rule returning union type', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|na<|>me|>: string
        }

        interface B {
            foo: string
        }

        type C = A | B ;

        ruleC returns C: {A} <|na<|>me|>=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to a property assigned in actions', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|na<|>me|>: string
        }

        ActionRule: {A} <|na<|>me|>=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to a property assigned in actions returning child type', async () => {
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|na<|>me|>: string
        }

        interface B extends A {}

        ActionRule: {B} <|na<|>me|>=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to property assigned in parser rule returning child of child', async () =>{
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|na<|>me|>: string
        }

        interface B extends A {}

        interface C extends B {}

        ruleC returns C: (<|na<|>me|>=ID);
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });

    test('Must find references to action assignment in parser rule returning interface', async () =>{
        const grammar = `grammar test
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;

        interface A {
            <|<|>x|>: X
        }

        ruleA returns A: X {A.<|<|>x|>=current};
        X: name=ID;
        `;

        await findReferences({
            text: grammar,
            includeDeclaration: true
        });
    });
});
