/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AsyncDisposable, EmptyFileSystem, LangiumDocument } from 'langium';
import { ParseHelperOptions, ValidationResult, textDocumentParams, validationHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';
import type { Diagnostic } from 'vscode-languageserver';
import { CodeAction } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createLangiumGrammarServices } from '../../../src/grammar/langium-grammar-module.js';
import { IssueCodes } from '../../../src/grammar/index.js';
import { LangiumServices } from '../../../lib/lsp/lsp-services.js';

const services = createLangiumGrammarServices(EmptyFileSystem);
const testQuickFixes = testQuickFix(services.grammar);

// Some of these test data are exported, since they are reused for corresponding test cases 

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

export const textBeforeParserRuleCrossReferencesWithInfers = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    Person infers PersonType: Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[PersonType:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

export const textExpectedParserRuleCrossReferencesWithInfers = `
    grammar ParserRulesOnlyForCrossReferences
    entry Model: (persons+=Neighbor | friends+=Friend | greetings+=Greeting)*;
    Neighbor:   'neighbor'  name=ID;
    Friend:     'friend'    name=ID;

    type PersonType = Neighbor | Friend; // 'Person' is used only for cross-references, not as parser rule
    Greeting: 'Hello' person=[PersonType:ID] '!';

    hidden terminal WS: /\\s+/;
    terminal ID: /[_a-zA-Z][\\w_]*/;
`;

describe('Langium grammar quick-fixes for validations: Parser rules used only as type in cross-references are not marked as unused, but with a hint suggesting a type declaration', () => {
    // these test cases target https://github.com/eclipse-langium/langium/issues/1309

    test('The parser rule has an implicitly inferred type', async () => {
        const result = await testQuickFixes(textBeforeParserRuleCrossReferences, IssueCodes.ParserRuleToTypeDecl, textExpectedParserRuleCrossReferences);
        const action = result.action;
        expect(action).toBeTruthy();
        expect(action!.title).toBe('Replace parser rule by type declaration');
    });

    test('The parser rule has an explicitly inferred type', async () => {
        await testQuickFixes(textBeforeParserRuleCrossReferencesWithInfers, IssueCodes.ParserRuleToTypeDecl, textExpectedParserRuleCrossReferencesWithInfers);
    });

    // TODO test cases, where no quick-fix action is provided
});

export interface QuickFixResult<T extends AstNode = AstNode> extends AsyncDisposable {
    /** the document containing the AST */
    document: LangiumDocument<T>;
    /** all diagnostics of the validation */
    diagnosticsAll: Diagnostic[];
    /** the relevant Diagnostic with the given diagnosticCode, it is expected that the given input has exactly one such diagnostic */
    diagnosticRelevant: Diagnostic;
    /** the CodeAction to fix the found relevant problem, it is possible, that there is no such code action */
    action?: CodeAction;
}
/**
 * This is a helper function to easily test quick-fixes for validation problems.
 * @param services the Langium services for the language with quick fixes
 * @returns A function to easily test a single quick-fix on the given invalid 'input'.
 * This function expects, that 'input' contains exactly one validation problem with the given 'diagnosticCode'.
 * If 'outputAfterFix' is specified, this functions checks, that the diagnostic comes with a single quick-fix for this validation problem.
 * After applying this quick-fix, 'input' is transformed to 'outputAfterFix'.
 */
export function testQuickFix<T extends AstNode = AstNode>(services: LangiumServices):
        (input: string, diagnosticCode: string, outputAfterFix: string | undefined, options?: ParseHelperOptions) => Promise<QuickFixResult<T>> {
    const validateHelper = validationHelper<T>(services);
    return async (input, diagnosticCode, outputAfterFix, options) => {
        // parse + validate
        const validationBefore = await validateHelper(input, options);
        const document = validationBefore.document;
        const diagnosticsAll = document.diagnostics ?? [];
        // use only the diagnostics with the given validation code
        const diagnosticsRelevant = diagnosticsAll.filter(d => d.data && 'code' in d.data && d.data.code === diagnosticCode);
        // expect exactly one validation with the given code
        expect(diagnosticsRelevant.length).toBe(1);
        const diagnosticRelevant = diagnosticsRelevant[0];

        // check, that the quick-fixes are generated for the selected validation:
        // prepare the action provider
        const actionProvider = services.lsp.CodeActionProvider;
        expect(actionProvider).toBeTruthy();
        // request the actions for this diagnostic
        const currentActions = await actionProvider!.getCodeActions(document, {
            ...textDocumentParams(document),
            range: diagnosticRelevant.range,
            context: {
                diagnostics: diagnosticsRelevant,
                triggerKind: 1 // explicitly triggered by users (or extensions)
            }
        });

        // evaluate the resulting actions
        let action: CodeAction | undefined;
        let validationAfter: ValidationResult | undefined;
        if (outputAfterFix) {
            // exactly one quick-fix is expected
            expect(currentActions).toBeTruthy();
            expect(Array.isArray(currentActions)).toBeTruthy();
            expect(currentActions!).toHaveLength(1);
            expect(CodeAction.is(currentActions![0])).toBeTruthy();
            action = currentActions![0] as CodeAction;

            // execute the found quick-fix
            const edits = action.edit?.changes![document.textDocument.uri];
            expect(edits).toBeTruthy();
            const updatedText = TextDocument.applyEdits(document.textDocument, edits!);

            // check the result after applying the quick-fix:
            // 1st text is updated as expected
            expect(updatedText).toBe(outputAfterFix);
            // 2nd the validation diagnostic is gone after the fix
            validationAfter = await validateHelper(updatedText, options);
            const diagnosticsUpdated = validationAfter.diagnostics.filter(d => d.data && 'code' in d.data && d.data.code === diagnosticCode);
            expect(diagnosticsUpdated).toHaveLength(0);
        } else {
            // no quick-fix is expected
            expect(currentActions).toBeFalsy();
        }

        async function dispose(): Promise<void> {
            validationBefore.dispose();
            validationAfter?.dispose();
        }
        return {
            document,
            diagnosticsAll,
            diagnosticRelevant: diagnosticRelevant,
            action,
            dispose: () => dispose()
        };
    };
}
