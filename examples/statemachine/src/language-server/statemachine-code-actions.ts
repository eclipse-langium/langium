/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type {
    AstNode,
    DiagnosticData,
    LangiumDocument,
    MaybePromise,
    Reference,
} from 'langium';
import type { CodeActionProvider } from 'langium/lsp';
import type {
    CodeActionParams,
    Command,
    CodeAction,
    Diagnostic,
    TextEdit,
    Range,
    Position,
} from 'vscode-languageserver';
import { CodeActionKind } from 'vscode-languageserver';
import { IssueCodes } from './statemachine-validator.js';
import type { State, Statemachine } from './generated/ast.js';

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

    private createCodeActions(
        diagnostic: Diagnostic,
        document: LangiumDocument,
        accept: (ca: CodeAction | undefined) => void
    ): void {
        switch ((diagnostic.data as DiagnosticData)?.code) {
            case IssueCodes.StateNameUppercase:
                accept(this.makeUpperCase(diagnostic, document));
                break;
            case IssueCodes.UnreachedState:
            case IssueCodes.UnreachedCommand:
            case IssueCodes.UnreachedEvent:
                accept(this.removeUnusedSymbol(diagnostic, document));
                break;
        }
        return undefined;
    }

    private makeUpperCase(
        diagnostic: Diagnostic,
        document: LangiumDocument
    ): CodeAction {
        const changes: TextEdit[] = [];

        const stateName = document.textDocument.getText(diagnostic.range);
        const { init, states } = document.parseResult.value as Statemachine;
        this.updateChangesForReferencedState(init, stateName, document, changes);

        states.forEach(({ transitions }) => {
            transitions.forEach(({ state }) => {
                this.updateChangesForReferencedState(
                    state,
                    stateName,
                    document,
                    changes
                );
            });
        });

        const range = this.getFirstLetterRange(diagnostic.range.start);
        changes.push(this.createTextEditForState(range, document));
        return {
            title: 'First letter to upper case',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: changes,
                },
            },
        };
    }

    private createTextEditForState(
        range: Range,
        document: LangiumDocument
    ): TextEdit {
        const changeRange = this.getFirstLetterRange(range.start);
        return {
            range: changeRange,
            newText: document.textDocument.getText(changeRange).toUpperCase(),
        };
    }

    private updateChangesForReferencedState(
        state: Reference<State>,
        name: string,
        document: LangiumDocument,
        changes: TextEdit[]
    ): void {
        if (state.$refNode && state.ref && state.ref.name === name) {
            const { range } = state.$refNode;
            const changeRange = this.getFirstLetterRange(range.start);
            changes.push(this.createTextEditForState(changeRange, document));
        }
    }

    private getFirstLetterRange(position: Position): Range {
        const range: Range = {
            start: position,
            end: {
                line: position.line,
                character: position.character + 1,
            },
        };
        return range;
    }

    private removeUnusedSymbol(
        diagnostic: Diagnostic,
        document: LangiumDocument
    ): CodeAction {
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
                            newText: '',
                        },
                    ],
                },
            },
        };
    }
}
