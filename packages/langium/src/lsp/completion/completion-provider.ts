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
import { findLeafNodeAtOffset } from '../../utils/cst-util';
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

    async getCompletion(document: LangiumDocument, params: CompletionParams): Promise<CompletionList | undefined> {
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
            await this.completionForRule(undefined, parserRule, acceptor);
            return CompletionList.create(items, true);
        }

        const parserStart = this.backtrackToTokenStart(document.textDocument.getText(), offset);
        const beforeFeatures = this.findFeaturesAt(document.textDocument, parserStart);
        let afterFeatures: ast.AbstractElement[] = [];
        const reparse = offset !== parserStart;
        if (reparse) {
            afterFeatures = this.findFeaturesAt(document.textDocument, offset);
        }

        const distinctionFunction = (element: ast.AbstractElement) => {
            if (ast.isKeyword(element)) {
                return element.value;
            } else {
                return element;
            }
        };

        await Promise.all(
            stream(beforeFeatures)
                .distinct(distinctionFunction)
                .map(e => this.completionFor(node.element, e, acceptor))
        );

        if (reparse) {
            const missingPart = document.textDocument.getText({
                start: document.textDocument.positionAt(parserStart),
                end: params.position
            }).toLowerCase();
            // Remove items from `beforeFeatures` which don't fit the current text
            items = items.filter(e => e.label.toLowerCase().startsWith(missingPart));

            await Promise.all(
                stream(afterFeatures)
                    .exclude(beforeFeatures, distinctionFunction)
                    .distinct(distinctionFunction)
                    .map(e => this.completionFor(node.element, e, acceptor))
            );
        }

        return CompletionList.create(items, true);
    }

    protected findFeaturesAt(document: TextDocument, offset: number): ast.AbstractElement[] {
        const text = document.getText({
            start: Position.create(0, 0),
            end: document.positionAt(offset)
        });
        const parserResult = this.completionParser.parse(text);
        const tokens = parserResult.tokens;
        // If the parser didn't parse any tokens, return the next features of the entry rule
        if (parserResult.tokenIndex === 0) {
            const parserRule = getEntryRule(this.grammar)!;
            const firstFeatures = findFirstFeatures(parserRule.definition);
            if (tokens.length > 0) {
                // We have to skip the first token
                // The interpreter will only look at the next features, which requires every token after the first
                tokens.shift();
                return findNextFeatures(firstFeatures.map(e => [e]), tokens);
            } else {
                return firstFeatures;
            }
        }
        const leftoverTokens = [...tokens].splice(parserResult.tokenIndex);
        const features = findNextFeatures([parserResult.elementStack], leftoverTokens);
        return features;
    }

    protected backtrackToTokenStart(text: string, offset: number): number {
        if (offset < 1) {
            return offset;
        }
        const wordRegex = /\w/;
        const whiteSpaceRegex = /\s/;
        let lastCharacter = text.charAt(offset - 1);
        if (whiteSpaceRegex.test(lastCharacter)) {
            return offset;
        }
        while (wordRegex.test(lastCharacter) && offset > 1) {
            offset--;
            lastCharacter = text.charAt(offset - 1);
        }
        return offset;
    }

    protected async completionForRule(astNode: AstNode | undefined, rule: ast.AbstractRule, acceptor: CompletionAcceptor): Promise<void> {
        if (ast.isParserRule(rule)) {
            const features = findFirstFeatures(rule.definition);
            await Promise.all(features.map(e => this.completionFor(astNode, e, acceptor)));
        }
    }

    protected completionFor(astNode: AstNode | undefined, feature: ast.AbstractElement, acceptor: CompletionAcceptor): MaybePromise<void> {
        if (ast.isKeyword(feature)) {
            return this.completionForKeyword(feature, astNode, acceptor);
        } else if (ast.isRuleCall(feature) && feature.rule.ref) {
            return this.completionForRule(astNode, feature.rule.ref, acceptor);
        } else if (ast.isCrossReference(feature) && astNode) {
            return this.completionForCrossReference(feature, astNode, acceptor);
        }
    }

    protected completionForCrossReference(crossRef: ast.CrossReference, context: AstNode, acceptor: CompletionAcceptor): MaybePromise<void> {
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
                if (!duplicateStore.has(e.name) && this.filterCrossReference(e)) {
                    acceptor(e, this.createReferenceCompletionItem(e));
                    duplicateStore.add(e.name);
                }
            });
        }
    }

    /**
     * Override this method to change how reference completion items are created.
     * Most notably useful to change the `kind` property which indicates which icon to display on the client.
     *
     * @param nodeDescription The description of a reference candidate
     * @returns A partial completion item
     */
    protected createReferenceCompletionItem(nodeDescription: AstNodeDescription): Partial<CompletionItem> {
        return {
            kind: CompletionItemKind.Reference,
            detail: nodeDescription.type,
            sortText: '0'
        };
    }

    protected filterCrossReference(_nodeDescription: AstNodeDescription): boolean {
        return true;
    }

    protected completionForKeyword(keyword: ast.Keyword, context: AstNode | undefined, acceptor: CompletionAcceptor): MaybePromise<void> {
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
        const item: CompletionItem = { label, textEdit, ...info };
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
