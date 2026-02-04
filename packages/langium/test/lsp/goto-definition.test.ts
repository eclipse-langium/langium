/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { EmptyFileSystem, URI } from 'langium';
import { createLangiumGrammarServices, createServicesForGrammar } from 'langium/grammar';
import { expectGoToDefinition } from 'langium/test';
import { expandToString } from 'langium/generate';
import type { Range } from 'vscode-languageserver';

/**
 * Represents a grammar file
 *
 * `index` <|> represents the position of the cursor where the GoTo Request is executed
 * `rangeIndex` <|ABC|> represent the range that should be targeted by a GoTo Request
 */
const text = `
grammar test

term<|>inal ID: /\\w+/;
hidden terminal WS: /\\s+/;
hidden terminal <|COMMENT|>: /\\/\\/.*/;

Model: value=<|>Ent<|>ity;

<|Ent<|>ity|>: name=ID;

interface A {
    <|name|>:string
}

X retu<|>rns A:
    <|>na<|>me<|>=ID; <|>
`.trim();

const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
const gotoDefinition = expectGoToDefinition(grammarServices);

describe('Definition Provider', () => {

    test('Entity must find itself when referenced from start of other location', async () => {
        await gotoDefinition({
            text,
            index: 1,
            rangeIndex: 1
        });
    });

    test('Entity must find itself when referenced from within other location', async () => {
        await gotoDefinition({
            text,
            index: 2,
            rangeIndex: 1
        });
    });

    test('Entity must find itself when referenced from source location', async () => {
        await gotoDefinition({
            text,
            index: 3,
            rangeIndex: 1
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from start of location', async () => {
        await gotoDefinition({
            text,
            index: 5,
            rangeIndex: 2
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from within location', async () => {
        await gotoDefinition({
            text,
            index: 6,
            rangeIndex: 2
        });
    });

    test('Assignment name in parser rule X must find property name in interface A from end of location', async () => {
        await gotoDefinition({
            text,
            index: 7,
            rangeIndex: 2
        });
    });

    describe('Should not find anything on certain cst nodes', () => {

        test('Should find nothing on `terminal` keyword', async () => {
            await gotoDefinition({
                text,
                index: 0,
                rangeIndex: []
            });
        });

        test('Should find nothing on `returns` keyword', async () => {
            await gotoDefinition({
                text,
                index: 4,
                rangeIndex: []
            });
        });

        test('Should find nothing white space', async () => {
            await gotoDefinition({
                text,
                index: 8,
                rangeIndex: []
            });
        });
    });

    test('Should highlight full datatype rule node', async () => {
        const grammar = `
        grammar Test
        entry Model: (elements+=Element)*;
        Element: Source | Target;
        Source: 'source' name=FQN;
        Target: 'target' ref=[Source];
        FQN returns string: ID ('.' ID)*;
        terminal ID: /\\w+/;
        hidden terminal WS: /\\s+/;
        `;
        const services = await createServicesForGrammar({ grammar });
        const text = expandToString`
            target a.b.c;
            source a.b.c;
        `;
        const workspace = services.shared.workspace;
        const document = workspace.LangiumDocumentFactory.fromString(text, URI.file('test.txt'));
        workspace.LangiumDocuments.addDocument(document);
        await workspace.DocumentBuilder.build([document]);
        const targetTextRange: Range = {
            start: document.textDocument.positionAt(text.indexOf('a.b.c')),
            end: document.textDocument.positionAt(text.indexOf('a.b.c') + 'a.b.c'.length)
        };
        const sourceTextRange: Range = {
            start: document.textDocument.positionAt(text.lastIndexOf('a.b.c')),
            end: document.textDocument.positionAt(text.lastIndexOf('a.b.c') + 'a.b.c'.length)
        };
        const provider = services.lsp.DefinitionProvider!;
        // Go to definition from target to source
        const defFromTarget = await provider.getDefinition(document, {
            textDocument: { uri: document.uri.toString() },
            position: targetTextRange.start,
        });
        expect(defFromTarget).toBeDefined();
        expect(defFromTarget).toHaveLength(1);
        const targetSourceRange = defFromTarget![0].originSelectionRange!;
        expect(targetSourceRange).toBeDefined();
        expect(targetSourceRange).toEqual(targetTextRange);
        // Go to definition from target to itself
        const defFromSource = await provider.getDefinition(document, {
            textDocument: { uri: document.uri.toString() },
            position: sourceTextRange.start,
        });
        expect(defFromSource).toBeDefined();
        expect(defFromSource).toHaveLength(1);
        const sourceRange = defFromSource![0].originSelectionRange!;
        expect(sourceRange).toBeDefined();
        expect(sourceRange).toEqual(sourceTextRange);
    });
});

describe('Definition Provider with Infix Operators', async () => {

    const infixGrammar = `
    grammar Test
    entry Model: elements+=Element*;
    Element: Statement | Item;
    Item: 'item' name=ID ';';

    Statement: value=Expression ';';

    Expression: InfixExpr;

    infix InfixExpr on Primary:
        '*' | '/' 
        > '+' | '-';

    Primary: '(' InfixExpr ')' | {infer ItemRef} ref=[Item];

    terminal ID: /\\w+/;
    hidden terminal WS: /\\s+/;
    hidden terminal COMMENT: /\\/\\/.*/;
    `;

    const infixServices = await createServicesForGrammar({ grammar: infixGrammar });
    const gotoDefinitionInfix = expectGoToDefinition(infixServices);

    test('Simple infix operator expression should find Item from reference', async () => {
        await gotoDefinitionInfix({
            text: `
            item <|a|>;
            <|>a;
            `,
            index: 0,
            rangeIndex: 0
        });
    });

    test('Complex infix operator expression should find Item from reference', async () => {
        const text = `
            item <|a|>;
            item <|b|>;
            item <|c|>;
            <|>a + <|>b * <|>c;
        `;
        await gotoDefinitionInfix({
            text,
            index: 0,
            rangeIndex: 0
        });
        await gotoDefinitionInfix({
            text,
            index: 1,
            rangeIndex: 1
        });
        await gotoDefinitionInfix({
            text,
            index: 2,
            rangeIndex: 2
        });
    });

});
