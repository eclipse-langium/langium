/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CodeActionKind, Diagnostic } from 'vscode-languageserver';
import { CodeActionParams } from 'vscode-languageserver-protocol';
import { CodeAction, Command, Position, TextEdit } from 'vscode-languageserver-types';
import { URI, Utils } from 'vscode-uri';
import { CodeActionProvider } from '../../lsp/code-action';
import { LangiumServices } from '../../services';
import { AstReflection, Reference, ReferenceInfo } from '../../syntax-tree';
import { getContainerOfType } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { findNodeForProperty } from '../../utils/grammar-util';
import { MaybePromise } from '../../utils/promise-util';
import { escapeRegExp } from '../../utils/regex-util';
import { equalURI, relativeURI } from '../../utils/uri-util';
import { DocumentValidator, LinkingErrorData } from '../../validation/document-validator';
import { DocumentSegment, LangiumDocument } from '../../workspace/documents';
import { IndexManager } from '../../workspace/index-manager';
import * as ast from '../generated/ast';
import { IssueCodes } from '../validation/validator';

export class LangiumGrammarCodeActionProvider implements CodeActionProvider {

    protected readonly reflection: AstReflection;
    protected readonly indexManager: IndexManager;

    constructor(services: LangiumServices) {
        this.reflection = services.shared.AstReflection;
        this.indexManager = services.shared.workspace.IndexManager;
    }

    getCodeActions(document: LangiumDocument, params: CodeActionParams): MaybePromise<Array<Command | CodeAction>> {
        const result: CodeAction[] = [];
        const acceptor = (ca: CodeAction | undefined) => ca && result.push(ca);
        for (const diagnostic of params.context.diagnostics) {
            this.createCodeActions(diagnostic, document, acceptor);
        }
        return result;
    }

    private createCodeActions(diagnostic: Diagnostic, document: LangiumDocument, accept: (ca: CodeAction | undefined) => void): void {
        switch (diagnostic.code) {
            case IssueCodes.GrammarNameUppercase:
            case IssueCodes.RuleNameUppercase:
                accept(this.makeUpperCase(diagnostic, document));
                break;
            case IssueCodes.HiddenGrammarTokens:
                accept(this.fixHiddenTerminals(diagnostic, document));
                break;
            case IssueCodes.UseRegexTokens:
                accept(this.fixRegexTokens(diagnostic, document));
                break;
            case IssueCodes.EntryRuleTokenSyntax:
                accept(this.addEntryKeyword(diagnostic, document));
                break;
            case IssueCodes.CrossRefTokenSyntax:
                accept(this.fixCrossRefSyntax(diagnostic, document));
                break;
            case IssueCodes.UnnecessaryFileExtension:
                accept(this.fixUnnecessaryFileExtension(diagnostic, document));
                break;
            case IssueCodes.MissingReturns:
                accept(this.fixMissingReturns(diagnostic, document));
                break;
            case IssueCodes.InvalidInfers:
            case IssueCodes.InvalidReturns:
                accept(this.fixInvalidReturnsInfers(diagnostic, document));
                break;
            case IssueCodes.MissingInfer:
                accept(this.fixMissingInfer(diagnostic, document));
                break;
            case IssueCodes.SuperfluousInfer:
                accept(this.fixSuperfluousInfer(diagnostic, document));
                break;
            case DocumentValidator.LinkingError: {
                const data = diagnostic.data as LinkingErrorData;
                if (data && data.containerType === 'RuleCall' && data.property === 'rule') {
                    accept(this.addNewRule(diagnostic, data, document));
                }
                if (data) {
                    this.lookInGlobalScope(diagnostic, data, document).forEach(accept);
                }
                break;
            }
        }
        return undefined;
    }

    /**
     * Adds missing returns for parser rule
     */
    private fixMissingReturns(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        const text = document.textDocument.getText(diagnostic.range);
        if (text) {
            return {
                title: `Add explicit return type for parser rule ${text}`,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.textDocument.uri]: [{
                            range: diagnostic.range,
                            newText: `${text} returns ${text}` // suggestion adds missing 'return'
                        }]
                    }
                }
            };
        }
        return undefined;
    }

    private fixInvalidReturnsInfers(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        const data = diagnostic.data as DocumentSegment;
        if (data) {
            const text = document.textDocument.getText(data.range);
            return {
                title: `Correct ${text} usage`,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.textDocument.uri]: [{
                            range: data.range,
                            newText: text === 'infers' ? 'returns' : 'infers'
                        }]
                    }
                }
            };
        }
        return undefined;
    }

    private fixMissingInfer(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        const data = diagnostic.data as DocumentSegment;
        if (data) {
            return {
                title: "Correct 'infer' usage",
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.textDocument.uri]: [{
                            range: {
                                start: data.range.end,
                                end: data.range.end
                            },
                            newText: 'infer '
                        }]
                    }
                }
            };
        }
        return undefined;
    }

    private fixSuperfluousInfer(diagnostic: Diagnostic, document: LangiumDocument): CodeAction | undefined {
        if (diagnostic.data) {
            return {
                title: "Remove the 'infer' keyword",
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.textDocument.uri]: [{
                            range: diagnostic.data,
                            newText: ''
                        }]
                    }
                }
            };
        }
        return undefined;
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
            const container = getContainerOfType(cstNode?.element, ast.isCharacterRange);
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
        const hiddenNode = findNodeForProperty(grammar.$cstNode, 'definesHiddenTokens');
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

    private addNewRule(diagnostic: Diagnostic, data: LinkingErrorData, document: LangiumDocument): CodeAction | undefined {
        const offset = document.textDocument.offsetAt(diagnostic.range.start);
        const rootCst = document.parseResult.value.$cstNode;
        if (rootCst) {
            const cstNode = findLeafNodeAtOffset(rootCst, offset);
            const container = getContainerOfType(cstNode?.element, ast.isParserRule);
            if (container && container.$cstNode) {
                return {
                    title: `Add new rule '${data.refText}'`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    isPreferred: false,
                    edit: {
                        changes: {
                            [document.textDocument.uri]: [{
                                range: {
                                    start: container.$cstNode.range.end,
                                    end: container.$cstNode.range.end
                                },
                                newText: '\n\n' + data.refText + ':\n    /* TODO implement rule */ {infer ' + data.refText + '};'
                            }]
                        }
                    }
                };
            }
        }
        return undefined;
    }

    private lookInGlobalScope(diagnostic: Diagnostic, data: LinkingErrorData, document: LangiumDocument): CodeAction[] {
        const refInfo: ReferenceInfo = {
            container: {
                $type: data.containerType
            },
            property: data.property,
            reference: {
                $refText: data.refText
            } as Reference
        };
        const referenceType = this.reflection.getReferenceType(refInfo);
        const candidates = this.indexManager.allElements(referenceType).filter(e => e.name === data.refText);

        const result: CodeAction[] = [];
        let shortestPathIndex = -1;
        let shortestPathLength = -1;
        for (const candidate of candidates) {
            if (equalURI(candidate.documentUri, document.uri)) {
                continue;
            }
            // Find an import path and a position to insert the import
            const importPath = getRelativeImport(document.uri, candidate.documentUri);
            let position: Position | undefined;
            let suffix = '';
            const grammar = document.parseResult.value as ast.Grammar;
            const nextImport = grammar.imports.find(imp => imp.path && importPath < imp.path);
            if (nextImport) {
                // Insert the new import alphabetically
                position = nextImport.$cstNode?.range.start;
            } else if (grammar.imports.length > 0) {
                // Put the new import after the last import
                const rangeEnd = grammar.imports[grammar.imports.length - 1].$cstNode!.range.end;
                if (rangeEnd) {
                    position = { line: rangeEnd.line + 1, character: 0 };
                }
            } else if (grammar.rules.length > 0) {
                // Put the new import before the first rule
                position = grammar.rules[0].$cstNode?.range.start;
                suffix = '\n';
            }

            if (position) {
                if (shortestPathIndex < 0 || importPath.length < shortestPathLength) {
                    shortestPathIndex = result.length;
                    shortestPathLength = importPath.length;
                }
                // Add an import declaration for the candidate in the global scope
                result.push({
                    title: `Add import to '${importPath}'`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    isPreferred: false,
                    edit: {
                        changes: {
                            [document.textDocument.uri]: [{
                                range: {
                                    start: position,
                                    end: position
                                },
                                newText: `import '${importPath}'\n${suffix}`
                            }]
                        }
                    }
                });
            }
        }

        // Mark the code action with the shortest import path as preferred
        if (shortestPathIndex >= 0) {
            result[shortestPathIndex].isPreferred = true;
        }
        return result;
    }

}

function getRelativeImport(source: URI, target: URI): string {
    const sourceDir = Utils.dirname(source);
    let relativePath = relativeURI(sourceDir, target);
    if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
        relativePath = './' + relativePath;
    }
    if (relativePath.endsWith('.langium')) {
        relativePath = relativePath.substring(0, relativePath.length - '.langium'.length);
    }
    return relativePath;
}
