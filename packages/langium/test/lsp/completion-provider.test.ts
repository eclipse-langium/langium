/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test, beforeEach } from 'vitest';
import type { AstNode, AstNodeDescription, LangiumDocument, Module } from 'langium';
import { DefaultAstNodeDescriptionProvider, EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import { DefaultCompletionProvider } from 'langium/lsp';
import type { LangiumServices, PartialLangiumServices } from 'langium/lsp';
import { clearDocuments, expectCompletion, parseHelper } from 'langium/test';
import { MarkupContent } from 'vscode-languageserver';
import * as assert from 'assert';

describe('Langium completion provider', () => {

    const text = `
    <|>gramm<|>ar g hid<|>den(hiddenTerminal)
    X: name="X";
    terminal hiddenTerminal: /x/;
    `;

    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const completion = expectCompletion(grammarServices);

    test('Should find starting rule', async () => {
        await completion({
            text,
            index: 0,
            expectedItems: [
                'grammar',
                // The grammar name element has become optional, so all other keywords are also included
                'import',
                'entry',
                'fragment',
                'hidden',
                'terminal',
                'interface',
                'type'
            ]
        });
    });

    test('Should find grammar keyword inside grammar keyword', async () => {
        await completion({
            text,
            index: 1,
            expectedItems: [
                'grammar'
            ]
        });
    });

    test('Should find hidden keyword', async () => {
        await completion({
            text,
            index: 2,
            expectedItems: [
                'hidden'
            ]
        });
    });

    test('Should perform case insensitive prefix matching', async () => {
        const model = `
        grammar g
        Aaaa: name="A";
        aaaa: name="a";
        Bbbb: name="B";
        C: a=aa<|>aa;`;
        // We expect 'Aaaa' and 'aaaa' but not 'Bbbb'
        await completion({
            text: model,
            index: 0,
            expectedItems: [
                'Aaaa',
                'aaaa'
            ]
        });
    });

    test('Should not complete next feature directly after ID', async () => {
        const model = `
        grammar g<|>
        A: name<|>="A";
        B: "B";`;
        // The completion provider used to propose any referencable element here
        // It should not propose anything
        await completion({
            text: model,
            index: 0,
            expectedItems: []
        });
        await completion({
            text: model,
            index: 1,
            expectedItems: []
        });
    });
});

describe('Completion within alternatives', () => {

    test('Should show correct keywords in completion of entry rule', async () => {

        const grammar = `
        grammar g
        entry Main: a?='a' 'b' 'c' | a?='a' 'b' 'd';
        hidden terminal WS: /\\s+/;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = '<|>a <|>b <|>c';

        await completion({
            text,
            index: 0,
            expectedItems: ['a']
        });
        await completion({
            text,
            index: 1,
            expectedItems: ['b']
        });
        await completion({
            text,
            index: 2,
            expectedItems: ['c', 'd']
        });
    });
    test('Should show correct keywords in completion of group', async () => {

        const grammar = `
        grammar g
        entry Main: ('a' a+=ID | 'b' b+=ID | 'c' c+=ID)*;
        hidden terminal WS: /\\s+/;
        terminal ID: /\\w+/;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = '<|>a id1 <|>b id2 <|>c id3';

        await completion({
            text,
            index: 0,
            expectedItems: ['a', 'b', 'c']
        });
        await completion({
            text,
            index: 1,
            expectedItems: ['a', 'b', 'c']
        });
        await completion({
            text,
            index: 2,
            expectedItems: ['a', 'b', 'c']
        });
    });
    test('Should show correct cross reference and keyword in completion', async () => {

        const grammar = `
        grammar g
        entry Main: elements+=(Item | Ref)*;
        Item: 'item' name=ID;
        Ref: 'ref' (ref=[Item] | self?='self');
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = 'item A ref <|>A';

        await completion({
            text,
            index: 0,
            expectedItems: ['A', 'self']
        });
    });

    test('Should remove duplicated entries', async () => {
        const grammar = `
        grammar g
        entry Model: (elements+=(Person | Greeting))*;
        Person: 'person' name=ID;
        // The following double 'person' assignment could lead to duplicated completion items
        Greeting: 'hello' (person1=[Person:ID] 'x' | person2=[Person:ID] 'y');

        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = `
        person A
        hello <|>
        `;

        await completion({
            text,
            index: 0,
            expectedItems: ['A']
        });
    });

    test('Should show documentation on completion items', async () => {
        const grammar = `
        grammar g
        entry Model: (elements+=(Person | Greeting))*;
        Person: 'person' name=ID;
        Greeting: 'hello' (person=[Person:ID]);
        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        hidden terminal WS: /\\s+/;
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);
        const text = `
        /** Hello this is A */
        person A
        hello <|>
        `;

        await completion({
            text,
            index: 0,
            expectedItems: ['Hello this is A'],
            itemToString: item => {
                assert.ok(MarkupContent.is(item.documentation), 'Completion item should be of type `MarkupContent`.');
                return item.documentation.value;
            }
        });
    });

    test('Should not remove same named NodeDescriptions', async () => {
        const grammar = `
        grammar g
        entry Model: (elements+=(Person | Greeting))*;
        Person: 'person' name=ID birth=INT;
        Greeting: 'hello' person=[Person:ID];

        terminal ID: /\\^?[_a-zA-Z][\\w_]*/;
        terminal INT: /\\d+/;
        hidden terminal WS: /\\s+/;
        `;

        const services = await createServicesForGrammar({
            grammar, module: {
                lsp: {
                    CompletionProvider: (services) => new class extends DefaultCompletionProvider {
                        override createReferenceCompletionItem(nodeDescription: AstNodeDescription) {
                            // Use <name> <birth> as label
                            const label = nodeDescription.name + ' ' + (nodeDescription as AstNodeDescription & { birth: string }).birth;
                            return { ...super.createReferenceCompletionItem(nodeDescription), label };
                        }
                    }(services),
                },
                workspace: {
                    AstNodeDescriptionProvider: (services) => new class extends DefaultAstNodeDescriptionProvider {
                        override createDescription(node: AstNode & { birth?: string }, name: string | undefined, document: LangiumDocument): AstNodeDescription & { birth?: string } {
                            // Add birth info to index
                            return { ...super.createDescription(node, name, document), birth: node.birth };
                        }
                    }(services)
                }
            } satisfies Module<LangiumServices, PartialLangiumServices>
        });
        const completion = expectCompletion(services);
        const text = `
        person John 1979
        person John 2023
        hello <|>
        `;

        await completion({
            text,
            index: 0,
            expectedItems: ['John 1979', 'John 2023']
        });
    });
});

describe('Path import completion', () => {

    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const completion = expectCompletion(grammarServices);
    const parse = parseHelper(grammarServices);
    let path = '';
    let text = '';

    beforeEach(async () => {
        await clearDocuments(grammarServices);
        const importedGrammar = "terminal ID: 'ID';";
        const document = await parse(importedGrammar);
        path = document.uri.path.substring(1);
        path = './' + path.substring(0, path.length - '.langium'.length);
        text = `
        grammar g
        import<|> <|>"<|>./<|>"
        entry Main: value=ID;
        `;
    });

    const testNames = [
        'Completes import before string start',
        'Completes import inside of string',
        'Completes import at the end of string'
    ];

    for (let i = 0; i < 3; i++) {
        const index = i + 1;
        test(testNames[i], async () => {
            await completion({
                text,
                index,
                expectedItems: [path]
            });
        });
    }

    test('Completes import keyword as expected', async () => {
        await completion({
            text,
            index: 0,
            expectedItems: ['import']
        });
    });
});

describe('Completion in data type rules', () => {

    test('Can perform completion for fully qualified names', async () => {
        const grammar = `
        grammar FQNCompletionTest

        entry Model:
            (persons+=Person | greetings+=Greeting)*;

        Person:
            'person' name=FQN;

        Greeting:
            'Hello' person=[Person:FQN] '!';

        FQN returns string: ID ('.' ID)*;

        hidden terminal WS: /\\s+/;
        terminal ID: /[_a-zA-Z][\\w_]*/;
        hidden terminal ML_COMMENT: /\\/\\*[\\s\\S]*?\\*\\//;
        `;

        const services = await createServicesForGrammar({ grammar });
        const completion = expectCompletion(services);

        const text = `
            person John.Miller
            person John.Smith.Junior
            person John.Smith.Senior

            Hello <|>John<|>.Smi<|>th.Jun<|>ior
            Hello <|>John./* Hello */ <|>Miller
        `;

        await completion({
            text: text,
            index: 0,
            expectedItems: [
                'John.Miller',
                'John.Smith.Junior',
                'John.Smith.Senior'
            ]
        });

        await completion({
            text: text,
            index: 1,
            expectedItems: [
                'John.Miller',
                'John.Smith.Junior',
                'John.Smith.Senior'
            ]
        });

        await completion({
            text: text,
            index: 2,
            expectedItems: [
                'John.Smith.Junior',
                'John.Smith.Senior'
            ]
        });

        await completion({
            text: text,
            index: 3,
            expectedItems: [
                'John.Smith.Junior'
            ]
        });

        await completion({
            text: text,
            index: 4,
            expectedItems: [
                'John.Miller',
                'John.Smith.Junior',
                'John.Smith.Senior'
            ]
        });

        // A comment within the FQN should prevent any completion from appearing
        await completion({
            text: text,
            index: 5,
            expectedItems: []
        });
    });

});
