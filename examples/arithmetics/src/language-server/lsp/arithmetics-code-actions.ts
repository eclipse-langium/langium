/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Diagnostic } from 'vscode-languageserver';
import { CodeActionKind } from 'vscode-languageserver';
import type { CodeActionParams } from 'vscode-languageserver-protocol';
import type { CodeAction, Command } from 'vscode-languageserver-types';
import type { MaybePromise, LangiumDocument, DiagnosticData } from 'langium';
import type { CodeActionProvider } from 'langium/lsp';
import { IssueCodes } from '../arithmetics-validator.js';

export class ArithmeticsCodeActionProvider implements CodeActionProvider {

    getCodeActions(document: LangiumDocument, params: CodeActionParams): MaybePromise<Array<Command | CodeAction>> {
        const result: CodeAction[] = [];
        const acceptor = (ca: CodeAction | undefined) => ca && result.push(ca);
        for (const diagnostic of params.context.diagnostics) {
            this.createCodeActions(diagnostic, document, acceptor);
        }
        return result;
    }

    private createCodeActions(diagnostic: Diagnostic, document: LangiumDocument, accept: (ca: CodeAction | undefined) => void): void {
        switch ((diagnostic.data as DiagnosticData)?.code) {
            case IssueCodes.ExpressionNormalizable:
                accept(this.normalizeExpression(diagnostic, document));
                break;
        }
    }

    private normalizeExpression(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        const data = diagnostic.data as DiagnosticData & { constant: number };
        if (data && typeof data.constant === 'number') {
            return {
                title: `Replace with constant ${data.constant}`,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: true,
                edit: {
                    changes: {
                        [document.textDocument.uri]: [{
                            range: diagnostic.range,
                            newText: data.constant.toString()
                        }]
                    }
                }
            };
        }
        return undefined;
    }
}

