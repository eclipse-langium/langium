/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CodeActionKind, Diagnostic } from 'vscode-languageserver';
import { CodeActionParams } from 'vscode-languageserver-protocol';
import { Command, CodeAction, TextEdit, Position } from 'vscode-languageserver-types';
import { LangiumDocument } from '../documents/document';
import { CodeActionProvider } from '../lsp/code-action';
import { MaybePromise } from '../utils/promise-util';
import { IssueCodes } from './langium-grammar-validator';
import { findLeafNodeAtOffset, getContainerOfType } from '../utils/ast-util';
import { escapeRegExp } from '../utils/regex-util';
import { findNodeForFeature } from './grammar-util';
import * as ast from './generated/ast';
import { EOL } from 'os';

export class LangiumGrammarCodeActionProvider implements CodeActionProvider {

    getCodeActions(document: LangiumDocument, params: CodeActionParams): MaybePromise<Array<Command | CodeAction>> {
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
            case IssueCodes.HiddenGrammarTokens:
                return this.fixHiddenTerminals(diagnostic, document);
            case IssueCodes.UseRegexTokens:
                return this.fixRegexTokens(diagnostic, document);
            case IssueCodes.EntryRuleTokenSyntax:
                return this.addEntryKeyword(diagnostic, document);
            case IssueCodes.CrossRefTokenSyntax:
                return this.fixCrossRefSyntax(diagnostic, document);
            case IssueCodes.MissingImport:
                return this.fixMissingImport(diagnostic, document);
            case IssueCodes.UnnecessaryFileExtension:
                return this.fixUnnecessaryFileExtension(diagnostic, document);
            default:
                return undefined;
        }
    }

    private fixUnnecessaryFileExtension(diagnostic: Diagnostic, document: LangiumDocument): CodeAction {
        const end = {...diagnostic.range.end};
        end.character -= 1;
        const start = {...end};
        start.character -= '.langium'.length;
        return {
            title: 'Remove file extension',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: [{
                        range: {
                            start,
                            end
                        },
                        newText: ''
                    }]
                }
            }
        };
    }

    private fixMissingImport(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        let position: Position;
        const grammar = document.parseResult.value as ast.Grammar;
        const imports = grammar.imports;
        const rules = grammar.rules;
        if (imports.length > 0) { // Find first import
            position = imports[0].$cstNode!.range.start;
        } else if (rules.length > 0) { // Find first rule
            position = rules[0].$cstNode!.range.start;
        } else {
            return undefined;
        }
        const path = diagnostic.data;
        if (typeof path === 'string') {
            return {
                title: `Add import to '${path}'`,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: true,
                edit: {
                    changes: {
                        [document.textDocument.uri]: [{
                            range: {
                                start: position,
                                end: position
                            },
                            newText: `import '${path}';${EOL}`
                        }]
                    }
                }
            };
        }
        return undefined;
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
                    [document.textDocument.uri]: [{
                        range,
                        newText: document.textDocument.getText(range).toUpperCase()
                    }]
                }
            }
        };
    }

    private addEntryKeyword(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        return {
            title: 'Add entry keyword',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: [{
                        range: {start: diagnostic.range.start, end: diagnostic.range.start},
                        newText: 'entry '
                    }]
                }
            }
        };
    }

    private fixRegexTokens(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        const offset = document.textDocument.offsetAt(diagnostic.range.start);
        const rootCst = document.parseResult.value.$cstNode;
        if (rootCst) {
            const cstNode = findLeafNodeAtOffset(rootCst, offset);
            const element = cstNode?.element;
            const container = ast.isCharacterRange(element) ? element : getContainerOfType(element, ast.isCharacterRange);
            if (container && container.right && container.$cstNode) {
                const left = container.left.value;
                const right = container.right.value;
                return {
                    title: 'Refactor into regular expression',
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    isPreferred: true,
                    edit: {
                        changes: {
                            [document.textDocument.uri]: [{
                                range: container.$cstNode.range,
                                newText: `/[${escapeRegExp(left)}-${escapeRegExp(right)}]/`
                            }]
                        }
                    }
                };
            }
        }
        return undefined;
    }

    private fixCrossRefSyntax(diagnostic: Diagnostic, document: LangiumDocument): CodeAction {
        return {
            title: "Replace '|' with ':'",
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: [{
                        range: diagnostic.range,
                        newText: ':'
                    }]
                }
            }
        };
    }

    private fixHiddenTerminals(diagnostic: Diagnostic, document: LangiumDocument): CodeAction {
        const grammar = document.parseResult.value as ast.Grammar;
        const hiddenTokens = grammar.hiddenTokens;
        const changes: TextEdit[] = [];
        const hiddenNode = findNodeForFeature(grammar.$cstNode, 'definesHiddenTokens');
        if (hiddenNode) {
            const start = hiddenNode.range.start;
            const offset = hiddenNode.offset;
            const end = grammar.$cstNode!.text.indexOf(')', offset) + 1;
            changes.push({
                newText: '',
                range: {
                    start,
                    end: document.textDocument.positionAt(end)
                }
            });
        }
        for (const terminal of hiddenTokens) {
            const ref = terminal.ref;
            if (ref && ast.isTerminalRule(ref) && !ref.hidden && ref.$cstNode) {
                const start = ref.$cstNode.range.start;
                changes.push({
                    newText: 'hidden ',
                    range: {
                        start,
                        end: start
                    }
                });
            }
        }
        return {
            title: 'Fix hidden terminals',
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: {
                changes: {
                    [document.textDocument.uri]: changes
                }
            }
        };
    }
}
