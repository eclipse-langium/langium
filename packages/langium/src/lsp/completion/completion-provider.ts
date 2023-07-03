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
import type { AstNode, AstNodeDescription, Reference, ReferenceInfo } from '../../syntax-tree';
import type { MaybePromise } from '../../utils/promise-util';
import type { LangiumDocument } from '../../workspace/documents';
import type { NextFeature } from './follow-element-computation';
import type { NodeKindProvider } from '../node-kind-provider';
import type { FuzzyMatcher } from '../fuzzy-matcher';
import type { Lexer } from '../../parser/lexer';
import { CompletionItemKind, CompletionList, Position } from 'vscode-languageserver';
import * as ast from '../../grammar/generated/ast';
import { getExplicitRuleType } from '../../grammar/internal-grammar-util';
import { getContainerOfType } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { getEntryRule } from '../../utils/grammar-util';
import { stream } from '../../utils/stream';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';

export type CompletionAcceptor = (value: CompletionValueItem) => void

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
    tokenOffset: number
    tokenEndOffset: number
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

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.grammar = services.Grammar;
        this.completionParser = services.parser.CompletionParser;
        this.nameProvider = services.references.NameProvider;
        this.lexer = services.parser.Lexer;
        this.nodeKindProvider = services.shared.lsp.NodeKindProvider;
        this.fuzzyMatcher = services.shared.lsp.FuzzyMatcher;
    }

    async getCompletion(document: LangiumDocument, params: CompletionParams): Promise<CompletionList | undefined> {
        const root = document.parseResult.value;
        const cst = root.$cstNode;
        if (!cst) {
            return undefined;
        }
        const items: CompletionItem[] = [];
        const textDocument = document.textDocument;
        const text = textDocument.getText();
        const offset = textDocument.offsetAt(params.position);
        const [lastTokenOffset, tokenOffset, tokenEndOffset] = this.backtrackToAnyToken(text, offset);
        const astNode = findLeafNodeAtOffset(cst, lastTokenOffset)?.element;

        const context: CompletionContext = {
            document,
            textDocument,
            node: astNode,
            tokenOffset,
            tokenEndOffset,
            offset,
            position: params.position
        };

        const acceptor: CompletionAcceptor = value => {
            const completionItem = this.fillCompletionItem(context, value);
            if (completionItem) {
                items.push(completionItem);
            }
        };

        if (!astNode) {
            const parserRule = getEntryRule(this.grammar)!;
            await this.completionForRule(context, parserRule, acceptor);
            return CompletionList.create(this.deduplicateItems(items), true);
        }

        const contexts: CompletionContext[] = [context];

        // In some cases, the completion depends on the concrete AST node at the current position
        // Often times, it is not clear whether the completion is related to the ast node at the current cursor position
        // (i.e. associated with the character right after the cursor), or the one before the cursor.
        // If these are different AST nodes, then we perform the completion twice
        if (tokenOffset === offset && tokenOffset > 0) {
            const previousAstNode = findLeafNodeAtOffset(cst, lastTokenOffset - 1)?.element;
            if (previousAstNode !== astNode) {
                contexts.push({
                    document,
                    textDocument,
                    node: previousAstNode,
                    tokenOffset,
                    tokenEndOffset,
                    offset,
                    position: params.position
                });
            }
        }

        const beforeFeatures = this.findFeaturesAt(textDocument, tokenOffset);
        let afterFeatures: NextFeature[] = [];
        const reparse = this.canReparse() && offset !== tokenOffset;
        if (reparse) {
            afterFeatures = this.findFeaturesAt(textDocument, offset);
        }

        const distinctionFunction = (element: NextFeature) => {
            if (ast.isKeyword(element.feature)) {
                return element.feature.value;
            } else {
                return element.feature;
            }
        };

        await Promise.all(
            stream(beforeFeatures)
                .distinct(distinctionFunction)
                .map(e => this.completionForContexts(contexts, e, acceptor))
        );

        if (reparse) {
            await Promise.all(
                stream(afterFeatures)
                    .exclude(beforeFeatures, distinctionFunction)
                    .distinct(distinctionFunction)
                    .map(e => this.completionForContexts(contexts, e, acceptor))
            );
        }

        return CompletionList.create(this.deduplicateItems(items), true);
    }

    /**
     * The completion algorithm could yield the same reference/keyword multiple times.
     *
     * This methods deduplicates these items afterwards before returning to the client.
     * Unique items are identified as a combination of `kind`, `label` and `detail`
     */
    protected deduplicateItems(items: CompletionItem[]): CompletionItem[] {
        return stream(items).distinct(item => `${item.kind}_${item.label}_${item.detail}`).toArray();
    }

    /**
     * Determines whether the completion parser will reparse the input at the point of completion.
     * By default, this returns `false`, indicating that the completion will only look for completion results starting from the token at the cursor position.
     * Override this and return `true` to indicate that the completion should parse the input a second time.
     * This might add some missing completions at the cost at parsing the input twice.
     */
    protected canReparse(): boolean {
        return false;
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

    /**
     * This methods return three integers that indicate token offsets.
     *
     * The first offset represents the start position of the last token before the cursor.
     *
     * The second offset represents the end of the last token before the cursor. This is either:
     * 1. The end of the token represented by the first offset, in case the cursor is after this token.
     * 2. The start of the token represented by the first offset, in case the cursor is within this token.
     *
     * The third offset represents the end of the last token, even if it is behind the cursor position
     */
    protected backtrackToAnyToken(text: string, offset: number): [number, number, number] {
        const tokens = this.lexer.tokenize(text).tokens;
        let lastToken = tokens[0];
        const lastIndex = tokens.length - 1;
        for (let i = 0; i < lastIndex; i++) {
            const token = tokens[i + 1];
            if (token.startOffset > offset) {
                // If the offset of the cursor has already arrived at the end of the current token, use the token end
                // Otherwise, use the token start as the current cursor position.
                const endOffset = lastToken.endOffset!;
                return [
                    lastToken.startOffset,
                    endOffset > offset ? lastToken.startOffset : endOffset,
                    endOffset
                ];
            }
            lastToken = token;
        }
        return [
            lastToken?.startOffset ?? offset,
            offset,
            lastToken?.endOffset ?? offset
        ];
    }

    protected async completionForRule(context: CompletionContext, rule: ast.AbstractRule, acceptor: CompletionAcceptor): Promise<void> {
        if (ast.isParserRule(rule)) {
            const firstFeatures = findFirstFeatures(rule.definition);
            await Promise.all(firstFeatures.map(next => this.completionFor(context, next, acceptor)));
        }
    }

    protected async completionForContexts(contexts: CompletionContext[], next: NextFeature, acceptor: CompletionAcceptor): Promise<void> {
        for (const context of contexts) {
            await this.completionFor(context, next, acceptor);
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
                        acceptor(this.createReferenceCompletionItem(e));
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
     * Most notably useful to change the `kind` property which indicates which icon to display on the client.
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
        acceptor({
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
