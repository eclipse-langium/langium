/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type {
    AstNode,
    CodeActionProvider,
    DiagnosticData,
    LangiumDocument,
    MaybePromise,
} from 'langium';
import type {
    CodeActionParams,
    Command,
    CodeAction,
    Diagnostic,
} from 'vscode-languageserver';
import { CodeActionKind } from 'vscode-languageserver';
import { IssueCodes } from './statemachine-validator.js';

export class StatemachineCodeActionProvider implements CodeActionProvider {
    getCodeActions(
        document: LangiumDocument<AstNode>,
        params: CodeActionParams
    ): MaybePromise<Array<Command | CodeAction> | undefined> {
        const result: CodeAction[] = [];
        const acceptor = (ca: CodeAction | undefined) => ca && result.push(ca);
        for (const diagnostic of params.context.diagnostics) {
            this.createCodeActions(diagnostic, document, acceptor);
        }
        return result;
    }

    private createCodeActions(diagnostic: Diagnostic, document: LangiumDocument, accept: (ca: CodeAction | undefined) => void): void {
        switch ((diagnostic.data as DiagnosticData)?.code) {
            case IssueCodes.StateNameUppercase:
                accept(this.makeUpperCase(diagnostic, document));
                break;
            case IssueCodes.UnusedSymbol:
                accept(this.removeUnusedSymbol(diagnostic, document));
                break;
        }
        return undefined;
    }

    private makeUpperCase(diagnostic: Diagnostic, document: LangiumDocument): CodeAction {
        const range = {
            start: diagnostic.range.start,
            end: {
                line: diagnostic.range.start.line,
                character: diagnostic.range.start.character + 1,
            },
        };
        return {
            title: 'First letter to upper case',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: [
                        {
                            range,
                            newText: document.textDocument
                                .getText(range)
                                .toUpperCase(),
                        },
                    ],
                },
            },
        };
    }

    private removeUnusedSymbol(diagnostic: Diagnostic, document: LangiumDocument): CodeAction {
        return {
            title: 'Remove unsed symbol',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: [
                        {
                            range: diagnostic.range,
                            newText: ''
                        },
                    ],
                },
            },
        };
    }
}
