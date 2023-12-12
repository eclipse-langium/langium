/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { GrammarAST } from 'langium';
import { EmptyFileSystem, createLangiumGrammarServices } from 'langium';
import { textDocumentParams, validationHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { CodeAction } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

const services = createLangiumGrammarServices(EmptyFileSystem);
const validate = validationHelper<GrammarAST.Grammar>(services.grammar);

export const textBeforeParserRuleCrossReferences = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    Person: Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const textExpectedParserRuleCrossReferences = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    type Person = Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[Person:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

describe('Langium grammar quick-fixes for validations', () => {
    test('Parser rules used only as type in cross-references are correctly identified as used', async () => {
        // this test case targets https://github.com/eclipse-langium/langium/issues/1309
        // check, that the expected validation hint is available
        const validation = await validate(textBeforeParserRuleCrossReferences);
        expect(validation.diagnostics).toHaveLength(1);
        // check, that the quick-fix is generated
        const actionProvider = services.grammar.lsp.CodeActionProvider;
        expect(actionProvider).toBeTruthy();
        const currentAcctions = await actionProvider!.getCodeActions(validation.document, {
            ...textDocumentParams(validation.document),
            range: validation.diagnostics[0].range,
            context: {
                diagnostics: validation.diagnostics,
                triggerKind: 1 // explicitly triggered by users (or extensions)
            }
        });
        // there is one quick-fix
        expect(currentAcctions).toBeTruthy();
        expect(Array.isArray(currentAcctions)).toBeTruthy();
        expect(currentAcctions!.length).toBe(1);
        expect(CodeAction.is(currentAcctions![0])).toBeTruthy();
        const action: CodeAction = currentAcctions![0] as CodeAction;
        // execute the found quick-fix
        expect(action.title).toBe('Replace parser rule by type declaration');
        const edits = action.edit?.changes![validation.document.textDocument.uri];
        expect(edits).toBeTruthy();
        const updatedText = TextDocument.applyEdits(validation.document.textDocument, edits!);

        // check the result after applying the quick-fix
        expect(updatedText).toBe(textExpectedParserRuleCrossReferences);
        const validationUpdated = await validate(updatedText);
        expect(validationUpdated.diagnostics).toHaveLength(0);
    });

});
