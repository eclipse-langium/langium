/******************************************************************************
 * Copyright 2024 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test, expect } from 'vitest';
import { createServicesForGrammar } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { expandToString } from 'langium/generate';
import type { MultiReference } from 'langium';

const languageService = await createServicesForGrammar({
    grammar: `
        grammar test
        entry Model: (persons+=Person | greetings+=Greeting)*;
        Person: 'person' name=ID;
        Greeting: 'hello' person=[*Person:ID];
        terminal ID: /[\\w]+/;
        hidden terminal WS :/\\s+/;
    `
});
const parse = parseHelper(languageService);

describe('Multi Reference', () => {

    const text = expandToString`
        person Alice
        person Bob
        person Alice

        hello Alice
    `.trim();

    test('Can reference multiple elements', async () => {
        const document = await parse(text);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = document.parseResult.value as any;
        expect(model.persons).toHaveLength(3);
        expect(model.greetings).toHaveLength(1);
        const greeting = model.greetings[0];
        const ref = greeting.person as MultiReference;
        expect(ref).toBeDefined();
        expect(ref.error).toBeUndefined();
        expect(ref.items).toHaveLength(2);
        expect(ref.items[0].ref).toHaveProperty('name', 'Alice');
        expect(ref.items[0].ref.$cstNode?.range.start.line).toBe(0);
        expect(ref.items[1].ref).toHaveProperty('name', 'Alice');
        expect(ref.items[1].ref.$cstNode?.range.start.line).toBe(2);
    });

    test('Can find multiple declarations for the reference', async () => {
        const references = languageService.references.References;
        const document = await parse(text);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = document.parseResult.value as any;
        const aliceRef = model.greetings[0].person;
        expect(aliceRef).toHaveProperty('$refText', 'Alice');
        const declarations = references.findDeclarations(aliceRef.$refNode);
        expect(declarations).toHaveLength(2);
        for (let i = 0; i < declarations.length; i++) {
            expect(declarations[i]).toHaveProperty('name', 'Alice');
            expect(declarations[i].$cstNode?.range.start.line).toBe(i * 2);
        }
    });

    test('Can find sibling declarations for own declaration', async () => {
        const references = languageService.references.References;
        const nameProvider = languageService.references.NameProvider;
        const document = await parse(text);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = document.parseResult.value as any;
        const alice1 = model.persons[0];
        expect(alice1).toHaveProperty('name', 'Alice');
        const alice1Name = nameProvider.getNameNode(alice1);
        expect(alice1Name).toBeDefined();
        const declarations = references.findDeclarations(alice1Name!);
        expect(declarations).toHaveLength(2);
        for (let i = 0; i < declarations.length; i++) {
            expect(declarations[i]).toHaveProperty('name', 'Alice');
            expect(declarations[i].$cstNode?.range.start.line).toBe(i * 2);
        }
    });

    test('Can find all references and declarations for a multi reference element', async () => {
        const referencesService = languageService.references.References;
        const document = await parse(text);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = document.parseResult.value as any;
        const alice2 = model.persons[2];
        expect(alice2).toHaveProperty('name', 'Alice');
        const references = referencesService.findReferences(alice2, {
            includeDeclaration: true
        }).toArray().sort((a, b) => a.segment.offset - b.segment.offset);
        expect(references).toHaveLength(3);
        for (let i = 0; i < references.length; i++) {
            expect(references[i].segment.range.start.line).toBe(i * 2);
            expect(text.substring(references[i].segment.offset, references[i].segment.end)).toBe('Alice');
        }
    });

});
