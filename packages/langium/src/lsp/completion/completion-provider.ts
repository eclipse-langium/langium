/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Position } from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import * as ast from '../../grammar/generated/ast';
import { getEntryRule, getTypeNameAtElement } from '../../grammar/grammar-util';
import { LangiumCompletionParser } from '../../parser/langium-parser';
import { NameProvider } from '../../references/naming';
import { ScopeProvider } from '../../references/scope';
import { LangiumServices } from '../../services';
import { AstNode, AstNodeDescription } from '../../syntax-tree';
import { getContainerOfType, isAstNode } from '../../utils/ast-util';
import { findLeafNodeAtOffset, findRelevantNode } from '../../utils/cst-util';
import { MaybePromise } from '../../utils/promise-util';
import { stream } from '../../utils/stream';
import { LangiumDocument } from '../../workspace/documents';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';

export type CompletionAcceptor = (value: string | AstNode | AstNodeDescription, item?: Partial<CompletionItem>) => void

/**
 * Language-specific service for handling completion requests.
 */
export interface CompletionProvider {
    /**
     * Handle a completion request.
     *
     * @throws `OperationCancelled` if cancellation is detected during execution
     * @throws `ResponseError` if an error is detected that should be sent as response to the client
     */
    getCompletion(document: LangiumDocument, params: CompletionParams, cancelToken?: CancellationToken): MaybePromise<CompletionList | undefined>
}

export class DefaultCompletionProvider implements CompletionProvider {

    protected readonly completionParser: LangiumCompletionParser;
    protected readonly scopeProvider: ScopeProvider;
    protected readonly grammar: ast.Grammar;
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.grammar = services.Grammar;
        this.completionParser = services.parser.CompletionParser;
        this.nameProvider = services.references.NameProvider;
    }

    getCompletion(document: LangiumDocument, params: CompletionParams): MaybePromise<CompletionList | undefined> {
        const root = document.parseResult.value;
        const cst = root.$cstNode;
        if (!cst) {
            return undefined;
        }
        let items: CompletionItem[] = [];
        const offset = document.textDocument.offsetAt(params.position);
        const acceptor = (value: string | AstNode | AstNodeDescription, item?: Partial<CompletionItem>) => {
            const completionItem = this.fillCompletionItem(document.textDocument, offset, value, item);
            if (completionItem) {
                items.push(completionItem);
            }
        };

        const node = findLeafNodeAtOffset(cst, offset);

        if (!node) {
            const parserRule = getEntryRule(this.grammar)!;
            this.completionForRule(undefined, parserRule, acceptor);
            return CompletionList.create(items, true);
        }

        const parserStart = this.backtrackToTokenStart(document.textDocument.getText(), offset);
        const beforeFeatures = this.findFeaturesAt(document.textDocument, parserStart);

        if (!beforeFeatures) {
            const parserRule = getEntryRule(this.grammar)!;
            this.completionForRule(undefined, parserRule, acceptor);
        } else {
            let afterFeatures: ast.AbstractElement[] = [];
            const reparse = offset !== parserStart;
            if (reparse) {
                const after = this.findFeaturesAt(document.textDocument, offset);
                if (after) {
                    afterFeatures = after;
                }
            }

            const distinctionFunction = (element: ast.AbstractElement) => {
                if (ast.isKeyword(element)) {
                    return element.value;
                } else {
                    return element;
                }
            };

            stream(beforeFeatures)
                .distinct(distinctionFunction)
                .forEach(e => this.completionFor(findRelevantNode(node), e, acceptor));

            if (reparse) {
                const missingPart = document.textDocument.getText({
                    start: document.textDocument.positionAt(parserStart),
                    end: params.position
                }).toLowerCase();
                // Remove items from `beforeFeatures` which don't fit the current text
                items = items.filter(e => e.label.toLowerCase().startsWith(missingPart));

                stream(afterFeatures)
                    .exclude(beforeFeatures, distinctionFunction)
                    .distinct(distinctionFunction)
                    .forEach(e => this.completionFor(findRelevantNode(node), e, acceptor));
            }
        }
        return CompletionList.create(items, true);
    }

    protected findFeaturesAt(document: TextDocument, offset: number): ast.AbstractElement[] | false {
        const text = document.getText({
            start: Position.create(0, 0),
            end: document.positionAt(offset)
        });
        const parserResult = this.completionParser.parse(text);
        // If the parser didn't parse any tokens, just return false
        if (!parserResult.token) {
            return false;
        }
        const leftoverTokens = [...parserResult.tokens].splice(parserResult.tokenIndex);
        const features = findNextFeatures(parserResult.elementStack, leftoverTokens);
        return features;
    }

    protected backtrackToTokenStart(text: string, offset: number): number {
        const wordRegex = /\w/;
        const whiteSpaceRegex = /\s/;
        let lastCharacter = text.charAt(offset - 1);
        if (whiteSpaceRegex.test(lastCharacter)) {
            return offset;
        }
        while (wordRegex.test(lastCharacter) && offset > 0) {
            offset--;
            lastCharacter = text.charAt(offset - 1);
        }
        return offset;
    }

    protected completionForRule(astNode: AstNode | undefined, rule: ast.AbstractRule, acceptor: CompletionAcceptor): void {
        if (ast.isParserRule(rule)) {
            const features = findFirstFeatures(rule.definition, new Map(), new Set());
            features.flatMap(e => this.completionFor(astNode, e, acceptor));
        }
    }

    protected completionFor(astNode: AstNode | undefined, feature: ast.AbstractElement, acceptor: CompletionAcceptor): void {
        if (ast.isKeyword(feature)) {
            this.completionForKeyword(feature, astNode, acceptor);
        } else if (ast.isRuleCall(feature) && feature.rule.ref) {
            return this.completionForRule(astNode, feature.rule.ref, acceptor);
        } else if (ast.isCrossReference(feature) && astNode) {
            this.completionForCrossReference(feature, astNode, acceptor);
        }
    }

    protected completionForCrossReference(crossRef: ast.CrossReference, context: AstNode, acceptor: CompletionAcceptor): void {
        const assignment = getContainerOfType(crossRef, ast.isAssignment);
        const parserRule = getContainerOfType(crossRef, ast.isParserRule);
        if (assignment && parserRule) {
            const refInfo: ReferenceInfo = {
                reference: {} as Reference,
                container: context,
                property: assignment.feature
            };
            const scope = this.scopeProvider.getScope(refInfo);
            const duplicateStore = new Set<string>();
            scope.getAllElements().forEach(e => {
                if (!duplicateStore.has(e.name)) {
                    acceptor(e, { kind: CompletionItemKind.Reference, detail: e.type, sortText: '0' });
                    duplicateStore.add(e.name);
                }
            });
        }
    }

    protected completionForKeyword(keyword: ast.Keyword, context: AstNode | undefined, acceptor: CompletionAcceptor): void {
        acceptor(keyword.value, { kind: CompletionItemKind.Keyword, detail: 'Keyword', sortText: /\w/.test(keyword.value) ? '1' : '2' });
    }

    protected fillCompletionItem(document: TextDocument, offset: number, value: string | AstNode | AstNodeDescription, info: Partial<CompletionItem> | undefined): CompletionItem | undefined {
        let label: string;
        if (typeof value === 'string') {
            label = value;
        } else if (isAstNode(value)) {
            const name = this.nameProvider.getName(value);
            if (!name) {
                return undefined;
            }
            label = name;
        } else if (!isAstNode(value)) {
            label = value.name;
        } else {
            return undefined;
        }
        const textEdit = this.buildCompletionTextEdit(document, offset, label);
        if (!textEdit) {
            return undefined;
        }
        const item: CompletionItem = { label, textEdit };
        if (info) {
            Object.assign(item, info);
        }
        return item;
    }

    protected buildCompletionTextEdit(document: TextDocument, offset: number, completion: string): TextEdit | undefined {
        let negativeOffset = 0;
        const content = document.getText();
        const contentLowerCase = content.toLowerCase();
        const completionLowerCase = completion.toLowerCase();
        for (let i = completionLowerCase.length; i > 0; i--) {
            const contentLowerCaseSub = contentLowerCase.substring(offset - i, offset);
            if (completionLowerCase.startsWith(contentLowerCaseSub) && (i === 0 || !this.isWordCharacterAt(contentLowerCase, offset - i - 1))) {
                negativeOffset = i;
                break;
            }
        }
        if (negativeOffset > 0 || offset === 0 || !this.isWordCharacterAt(completion, 0) || !this.isWordCharacterAt(content, offset - 1)) {
            const start = document.positionAt(offset - negativeOffset);
            const end = document.positionAt(offset);
            return {
                newText: completion,
                range: {
                    start,
                    end
                }
            };
        } else {
            return undefined;
        }
    }

    protected isWordCharacterAt(content: string, index: number): boolean {
        return /\w/.test(content.charAt(index));
    }
}
