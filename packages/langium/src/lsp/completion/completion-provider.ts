/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { CancellationToken, CompletionItem, CompletionParams } from 'vscode-languageserver';
import type { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import type { LangiumCompletionParser } from '../../parser/langium-parser';
import type { NameProvider } from '../../references/name-provider';
import type { ScopeProvider } from '../../references/scope-provider';
import type { LangiumServices } from '../../services';
import type { AstNode, AstNodeDescription, CstNode, Reference, ReferenceInfo } from '../../syntax-tree';
import type { MaybePromise } from '../../utils/promise-util';
import type { LangiumDocument } from '../../workspace/documents';
import type { NextFeature } from './follow-element-computation';
import type { NodeKindProvider } from '../node-kind-provider';
import type { FuzzyMatcher } from '../fuzzy-matcher';
import type { GrammarConfig } from '../../grammar/grammar-config';
import type { Lexer } from '../../parser/lexer';
import type { IToken } from 'chevrotain';
import { CompletionItemKind, CompletionList, Position } from 'vscode-languageserver';
import * as ast from '../../grammar/generated/ast';
import { getExplicitRuleType } from '../../grammar/internal-grammar-util';
import { getContainerOfType } from '../../utils/ast-util';
import { findDeclarationNodeAtOffset, findLeafNodeAtOffset } from '../../utils/cst-util';
import { getEntryRule } from '../../utils/grammar-util';
import { stream } from '../../utils/stream';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';

export type CompletionAcceptor = (context: CompletionContext, value: CompletionValueItem) => void

export type CompletionValueItem = ({
    label?: string
} | {
    node: AstNode
} | {
    nodeDescription: AstNodeDescription
}) & Partial<CompletionItem>;

export interface CompletionContext {
    node?: AstNode
    document: LangiumDocument
    textDocument: TextDocument
    features: NextFeature[]
    /**
     * Index at the start of the token related to this context.
     * If the context performs completion for a token that doesn't exist yet, it is equal to the `offset`.
     */
    tokenOffset: number
    /**
     * Index at the end of the token related to this context, even if it is behind the cursor position.
     * Points at the first character after the last token.
     * If the context performs completion for a token that doesn't exist yet, it is equal to the `offset`.
     */
    tokenEndOffset: number
    /**
     * Index of the requested completed position.
     */
    offset: number
    position: Position
}

export interface CompletionProviderOptions {
    /**
     * Most tools trigger completion request automatically without explicitly requesting
     * it using a keyboard shortcut (e.g. Ctrl+Space). Typically they do so when the user
     * starts to type an identifier. For example if the user types `c` in a JavaScript file
     * code complete will automatically pop up present `console` besides others as a
     * completion item. Characters that make up identifiers don't need to be listed here.
     *
     * If code complete should automatically be trigger on characters not being valid inside
     * an identifier (for example `.` in JavaScript) list them in `triggerCharacters`.
     */
    triggerCharacters?: string[];
    /**
     * The list of all possible characters that commit a completion. This field can be used
     * if clients don't support individual commit characters per completion item.
     *
     * If a server provides both `allCommitCharacters` and commit characters on an individual
     * completion item the ones on the completion item win.
     */
    allCommitCharacters?: string[];
}

export interface CompletionBacktrackingInformation {
    previousTokenStart?: number;
    previousTokenEnd?: number;
    nextTokenStart: number;
    nextTokenEnd: number;
}

export function mergeCompletionProviderOptions(options: Array<CompletionProviderOptions | undefined>): CompletionProviderOptions {
    const triggerCharacters = Array.from(new Set(options.flatMap(option => option?.triggerCharacters ?? [])));
    const allCommitCharacters = Array.from(new Set(options.flatMap(option => option?.allCommitCharacters ?? [])));
    return {
        triggerCharacters: triggerCharacters.length > 0 ? triggerCharacters : undefined,
        allCommitCharacters: allCommitCharacters.length > 0 ? allCommitCharacters : undefined
    };
}

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
    /**
     * Contains the completion options for this completion provider.
     *
     * If multiple languages return different options, they are merged before being sent to the language client.
     */
    readonly completionOptions?: CompletionProviderOptions;
}

export class DefaultCompletionProvider implements CompletionProvider {

    protected readonly completionParser: LangiumCompletionParser;
    protected readonly scopeProvider: ScopeProvider;
    protected readonly grammar: ast.Grammar;
    protected readonly nameProvider: NameProvider;
    protected readonly lexer: Lexer;
    protected readonly nodeKindProvider: NodeKindProvider;
    protected readonly fuzzyMatcher: FuzzyMatcher;
    protected readonly grammarConfig: GrammarConfig;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.grammar = services.Grammar;
        this.completionParser = services.parser.CompletionParser;
        this.nameProvider = services.references.NameProvider;
        this.lexer = services.parser.Lexer;
        this.nodeKindProvider = services.shared.lsp.NodeKindProvider;
        this.fuzzyMatcher = services.shared.lsp.FuzzyMatcher;
        this.grammarConfig = services.parser.GrammarConfig;
    }

    async getCompletion(document: LangiumDocument, params: CompletionParams): Promise<CompletionList | undefined> {
        const items: CompletionItem[] = [];
        const contexts = this.buildContexts(document, params.position);

        const acceptor: CompletionAcceptor = (context, value) => {
            const completionItem = this.fillCompletionItem(context, value);
            if (completionItem) {
                items.push(completionItem);
            }
        };

        const distinctionFunction = (element: NextFeature) => {
            if (ast.isKeyword(element.feature)) {
                return element.feature.value;
            } else {
                return element.feature;
            }
        };

        const completedFeatures: NextFeature[] = [];
        for (const context of contexts) {
            await Promise.all(
                stream(context.features)
                    .distinct(distinctionFunction)
                    .exclude(completedFeatures)
                    .map(e => this.completionFor(context, e, acceptor))
            );
            // Do not try to complete the same feature multiple times
            completedFeatures.push(...context.features);
            // We might want to stop computing completion results
            if (!this.continueCompletion(items)) {
                break;
            }
        }

        return CompletionList.create(this.deduplicateItems(items), true);
    }

    /**
     * The completion algorithm could yield the same reference/keyword multiple times.
     *
     * This methods deduplicates these items afterwards before returning to the client.
     * Unique items are identified as a combination of `kind`, `label` and `detail`.
     */
    protected deduplicateItems(items: CompletionItem[]): CompletionItem[] {
        return stream(items).distinct(item => `${item.kind}_${item.label}_${item.detail}`).toArray();
    }

    protected findFeaturesAt(document: TextDocument, offset: number): NextFeature[] {
        const text = document.getText({
            start: Position.create(0, 0),
            end: document.positionAt(offset)
        });
        const parserResult = this.completionParser.parse(text);
        const tokens = parserResult.tokens;
        // If the parser didn't parse any tokens, return the next features of the entry rule
        if (parserResult.tokenIndex === 0) {
            const parserRule = getEntryRule(this.grammar)!;
            const firstFeatures = findFirstFeatures({
                feature: parserRule.definition,
                new: true,
                type: getExplicitRuleType(parserRule)
            });
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
        const features = findNextFeatures([parserResult.elementStack.map(feature => ({ feature }))], leftoverTokens);
        return features;
    }

    protected *buildContexts(document: LangiumDocument, position: Position): IterableIterator<CompletionContext> {
        const cst = document.parseResult.value.$cstNode;
        if (!cst) {
            return;
        }
        const textDocument = document.textDocument;
        const text = textDocument.getText();
        const offset = textDocument.offsetAt(position);
        const partialContext = {
            document,
            textDocument,
            offset,
            position
        };
        // Data type rules need special handling, as their tokens are irrelevant for completion purposes.
        // If we encounter a data type rule at the current offset, we jump to the start of the data type rule.
        const dataTypeRuleOffsets = this.findDataTypeRuleStart(cst, offset);
        if (dataTypeRuleOffsets) {
            const [ruleStart, ruleEnd] = dataTypeRuleOffsets;
            const parentNode = findLeafNodeAtOffset(cst, ruleStart)?.element;
            const previousTokenFeatures = this.findFeaturesAt(textDocument, ruleStart);
            yield {
                ...partialContext,
                node: parentNode,
                tokenOffset: ruleStart,
                tokenEndOffset: ruleEnd,
                features: previousTokenFeatures,
            };
        }
        // For all other purposes, it's enough to jump to the start of the current/previous token
        const { nextTokenStart, nextTokenEnd, previousTokenStart, previousTokenEnd } = this.backtrackToAnyToken(text, offset);
        let astNode: AstNode | undefined;
        if (previousTokenStart !== undefined && previousTokenEnd !== undefined && previousTokenEnd === offset) {
            astNode = findLeafNodeAtOffset(cst, previousTokenStart)?.element;
            const previousTokenFeatures = this.findFeaturesAt(textDocument, previousTokenStart);
            yield {
                ...partialContext,
                node: astNode,
                tokenOffset: previousTokenStart,
                tokenEndOffset: previousTokenEnd,
                features: previousTokenFeatures,
            };
        }
        astNode = findLeafNodeAtOffset(cst, nextTokenStart)?.element
            ?? (previousTokenStart === undefined ? undefined : findLeafNodeAtOffset(cst, previousTokenStart)?.element);

        if (!astNode) {
            const parserRule = getEntryRule(this.grammar)!;
            const firstFeatures = findFirstFeatures(parserRule.definition);
            yield {
                ...partialContext,
                tokenOffset: nextTokenStart,
                tokenEndOffset: nextTokenEnd,
                features: firstFeatures
            };
        } else {
            const nextTokenFeatures = this.findFeaturesAt(textDocument, nextTokenStart);
            yield {
                ...partialContext,
                node: astNode,
                tokenOffset: nextTokenStart,
                tokenEndOffset: nextTokenEnd,
                features: nextTokenFeatures,
            };
        }
    }

    protected findDataTypeRuleStart(cst: CstNode, offset: number): [number, number] | undefined {
        let containerNode: CstNode | undefined = findDeclarationNodeAtOffset(cst, offset, this.grammarConfig.nameRegexp);
        // Identify whether the element was parsed as part of a data type rule
        let isDataTypeNode = Boolean(getContainerOfType(containerNode?.feature, ast.isParserRule)?.dataType);
        if (isDataTypeNode) {
            while (isDataTypeNode) {
                // Use the container to find the correct parent element
                containerNode = containerNode?.parent;
                isDataTypeNode = Boolean(getContainerOfType(containerNode?.feature, ast.isParserRule)?.dataType);
            }
            if (containerNode) {
                return [containerNode.offset, containerNode.end];
            }
        }
        return undefined;
    }

    /**
     * Indicates whether the completion should continue to process the next completion context.
     *
     * The default implementation continues the completion only if there are currently no proposed completion items.
     */
    protected continueCompletion(items: CompletionItem[]): boolean {
        return items.length === 0;
    }

    /**
     * This method returns two sets of token offset information.
     *
     * The `nextToken*` offsets are related to the token at the cursor position.
     * If there is none, both offsets are simply set to `offset`.
     *
     * The `previousToken*` offsets are related to the last token before the current token at the cursor position.
     * They are `undefined`, if there is no token before the cursor position.
     */
    protected backtrackToAnyToken(text: string, offset: number): CompletionBacktrackingInformation {
        const tokens = this.lexer.tokenize(text).tokens;
        if (tokens.length === 0) {
            // If we don't have any tokens in our document, just return the offset position
            return {
                nextTokenStart: offset,
                nextTokenEnd: offset
            };
        }
        let previousToken: IToken | undefined;
        for (const token of tokens) {
            if (token.startOffset >= offset) {
                // We are between two tokens
                // Return the current offset as the next token index
                return {
                    nextTokenStart: offset,
                    nextTokenEnd: offset,
                    previousTokenStart: previousToken ? previousToken.startOffset : undefined,
                    previousTokenEnd: previousToken ? previousToken.endOffset! + 1 : undefined
                };
            }
            if (token.endOffset! >= offset) {
                // We are within a token
                // Return the current and previous token offsets as normal
                return {
                    nextTokenStart: token.startOffset,
                    nextTokenEnd: token.endOffset! + 1,
                    previousTokenStart: previousToken ? previousToken.startOffset : undefined,
                    previousTokenEnd: previousToken ? previousToken.endOffset! + 1 : undefined
                };
            }
            previousToken = token;
        }
        // We have run into the end of the file
        // Return the current offset as the next token index
        return {
            nextTokenStart: offset,
            nextTokenEnd: offset,
            previousTokenStart: previousToken ? previousToken.startOffset : undefined,
            previousTokenEnd: previousToken ? previousToken.endOffset! + 1 : undefined
        };
    }

    protected async completionForRule(context: CompletionContext, rule: ast.AbstractRule, acceptor: CompletionAcceptor): Promise<void> {
        if (ast.isParserRule(rule)) {
            const firstFeatures = findFirstFeatures(rule.definition);
            await Promise.all(firstFeatures.map(next => this.completionFor(context, next, acceptor)));
        }
    }

    protected completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
        if (ast.isKeyword(next.feature)) {
            return this.completionForKeyword(context, next.feature, acceptor);
        } else if (ast.isCrossReference(next.feature) && context.node) {
            return this.completionForCrossReference(context, next as NextFeature<ast.CrossReference>, acceptor);
        }
    }

    protected completionForCrossReference(context: CompletionContext, crossRef: NextFeature<ast.CrossReference>, acceptor: CompletionAcceptor): MaybePromise<void> {
        const assignment = getContainerOfType(crossRef.feature, ast.isAssignment);
        let node = context.node;
        if (assignment && node) {
            if (crossRef.type && (crossRef.new || node.$type !== crossRef.type)) {
                node = {
                    $type: crossRef.type,
                    $container: node,
                    $containerProperty: crossRef.property
                };
            }
            if (!context) {
                return;
            }
            const refInfo: ReferenceInfo = {
                reference: {} as Reference,
                container: node,
                property: assignment.feature
            };
            try {
                const scope = this.scopeProvider.getScope(refInfo);
                const duplicateStore = new Set<string>();
                scope.getAllElements().forEach(e => {
                    if (!duplicateStore.has(e.name) && this.filterCrossReference(e)) {
                        acceptor(context, this.createReferenceCompletionItem(e));
                        duplicateStore.add(e.name);
                    }
                });
            } catch (err) {
                console.error(err);
            }
        }
    }

    /**
     * Override this method to change how reference completion items are created.
     * To change the `kind` of a completion item, override the `NodeKindProvider` service instead.
     *
     * @param nodeDescription The description of a reference candidate
     * @returns A partial completion item
     */
    protected createReferenceCompletionItem(nodeDescription: AstNodeDescription): CompletionValueItem {
        return {
            nodeDescription,
            kind: this.nodeKindProvider.getCompletionItemKind(nodeDescription),
            detail: nodeDescription.type,
            sortText: '0'
        };
    }

    protected filterCrossReference(_nodeDescription: AstNodeDescription): boolean {
        return true;
    }

    protected completionForKeyword(context: CompletionContext, keyword: ast.Keyword, acceptor: CompletionAcceptor): MaybePromise<void> {
        // Filter out keywords that do not contain any word character
        if (!keyword.value.match(/[\w]/)) {
            return;
        }
        acceptor(context, {
            label: keyword.value,
            kind: CompletionItemKind.Keyword,
            detail: 'Keyword',
            sortText: '1'
        });
    }

    protected fillCompletionItem(context: CompletionContext, item: CompletionValueItem): CompletionItem | undefined {
        let label: string;
        if (typeof item.label === 'string') {
            label = item.label;
        } else if ('node' in item) {
            const name = this.nameProvider.getName(item.node);
            if (!name) {
                return undefined;
            }
            label = name;
        } else if ('nodeDescription' in item) {
            label = item.nodeDescription.name;
        } else {
            return undefined;
        }
        let insertText: string;
        if (typeof item.textEdit?.newText === 'string') {
            insertText = item.textEdit.newText;
        } else if (typeof item.insertText === 'string') {
            insertText = item.insertText;
        } else {
            insertText = label;
        }
        const textEdit = item.textEdit ?? this.buildCompletionTextEdit(context, label, insertText);
        if (!textEdit) {
            return undefined;
        }
        // Copy all valid properties of `CompletionItem`
        const completionItem: CompletionItem = {
            additionalTextEdits: item.additionalTextEdits,
            command: item.command,
            commitCharacters: item.commitCharacters,
            data: item.data,
            detail: item.detail,
            documentation: item.documentation,
            filterText: item.filterText,
            insertText: item.insertText,
            insertTextFormat: item.insertTextFormat,
            insertTextMode: item.insertTextMode,
            kind: item.kind,
            labelDetails: item.labelDetails,
            preselect: item.preselect,
            sortText: item.sortText,
            tags: item.tags,
            textEditText: item.textEditText,
            textEdit,
            label
        };
        return completionItem;
    }

    protected buildCompletionTextEdit(context: CompletionContext, label: string, newText: string): TextEdit | undefined {
        const content = context.textDocument.getText();
        const identifier = content.substring(context.tokenOffset, context.offset);
        if (this.fuzzyMatcher.match(identifier, label)) {
            const start = context.textDocument.positionAt(context.tokenOffset);
            const end = context.position;
            return {
                newText,
                range: {
                    start,
                    end
                }
            };
        } else {
            return undefined;
        }
    }
}
