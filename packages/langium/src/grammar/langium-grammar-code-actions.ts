/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CodeActionKind, Diagnostic } from 'vscode-languageserver';
import { CodeActionParams } from 'vscode-languageserver-protocol';
import { Command, CodeAction } from 'vscode-languageserver-types';
import { LangiumDocument } from '../documents/document';
import { CodeActionProvider } from '../lsp/code-action';
import { IssueCodes } from './langium-grammar-validator';

export class LangiumGrammarCodeActionProvider implements CodeActionProvider {
    getCodeActions(document: LangiumDocument, params: CodeActionParams): Array<Command | CodeAction> | null {
        const result: CodeAction[] = [];
        for (const diagnostic of params.context.diagnostics) {
            const codeAction = this.createCodeAction(diagnostic, document);
            if (codeAction) {
                result.push(codeAction);
            }
        }
        return result;
    }

    private createCodeAction(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        switch (diagnostic.code) {
            case IssueCodes.GrammarNameUppercase:
            case IssueCodes.RuleNameUppercase:
                return this.makeUpperCase(diagnostic, document);
            default:
                return undefined;
        }
    }

    private makeUpperCase(diagnostic: Diagnostic, document: LangiumDocument): CodeAction {
        const range = {
            start: diagnostic.range.start,
            end: {
                line: diagnostic.range.start.line,
                character: diagnostic.range.start.character + 1
            }
        };
        return {
            title: 'First letter to upper case',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.uri]: [{
                        range,
                        newText: document.getText(range).toUpperCase()
                    }]
                }
            }
        };
    }
}