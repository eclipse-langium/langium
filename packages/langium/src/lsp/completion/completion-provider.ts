/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Position } from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import * as ast from '../../grammar/generated/ast';
import { GrammarConfig } from '../../grammar/grammar-config';
import { getExplicitRuleType } from '../../grammar/internal-grammar-util';
import { LangiumCompletionParser } from '../../parser/langium-parser';
import { NameProvider } from '../../references/name-provider';
import { ScopeProvider } from '../../references/scope-provider';
import { LangiumServices } from '../../services';
import { AstNode, AstNodeDescription, Reference, ReferenceInfo } from '../../syntax-tree';
import { getContainerOfType } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { getEntryRule } from '../../utils/grammar-util';
import { MaybePromise } from '../../utils/promise-util';
import { stream } from '../../utils/stream';
import { LangiumDocument } from '../../workspace/documents';
import { findFirstFeatures, findNextFeatures, NextFeature } from './follow-element-computation';

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
    offset: number
    position: Position
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
}

export class DefaultCompletionProvider implements CompletionProvider {

    protected readonly completionParser: LangiumCompletionParser;
    protected readonly scopeProvider: ScopeProvider;
    protected readonly grammar: ast.Grammar;
    protected readonly nameProvider: NameProvider;
    protected readonly grammarConfig: GrammarConfig;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.grammar = services.Grammar;
        this.completionParser = services.parser.CompletionParser;
        this.nameProvider = services.references.NameProvider;
        this.grammarConfig = services.parser.GrammarConfig;
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
        const acceptor: CompletionAcceptor = value => {
            const completionItem = this.fillCompletionItem(textDocument, offset, value);
            if (completionItem) {
                items.push(completionItem);
            }
        };

        const node = findLeafNodeAtOffset(cst, this.backtrackToAnyToken(text, offset));

        const context: CompletionContext = {
            document,
            textDocument,
            node: node?.element,
            offset,
            position: params.position
        };

        if (!node) {
            const parserRule = getEntryRule(this.grammar)!;
            await this.completionForRule(context, parserRule, acceptor);
            return CompletionList.create(items, true);
        }

        const parserStart = this.backtrackToTokenStart(text, offset);
        const beforeFeatures = this.findFeaturesAt(textDocument, parserStart);
        let afterFeatures: NextFeature[] = [];
        const reparse = this.canReparse() && offset !== parserStart;
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
                .map(e => this.completionFor(context, e, acceptor))
        );

        if (reparse) {
            await Promise.all(
                stream(afterFeatures)
                    .exclude(beforeFeatures, distinctionFunction)
                    .distinct(distinctionFunction)
                    .map(e => this.completionFor(context, e, acceptor))
            );
        }

        return CompletionList.create(items, true);
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

    protected backtrackToAnyToken(text: string, offset: number): number {
        if (offset >= text.length) {
            offset = text.length - 1;
        }
        while (offset > 0 && /\s/.test(text.charAt(offset))) {
            offset--;
        }
        return offset;
    }

    protected backtrackToTokenStart(text: string, offset: number): number {
        if (offset < 1) {
            return offset;
        }
        const wordRegex = this.grammarConfig.nameRegexp;
        let lastCharacter = text.charAt(offset - 1);
        while (offset > 0 && wordRegex.test(lastCharacter)) {
            offset--;
            lastCharacter = text.charAt(offset - 1);
        }
        return offset;
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
            kind: CompletionItemKind.Reference,
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

    protected fillCompletionItem(document: TextDocument, offset: number, item: CompletionValueItem): CompletionItem | undefined {
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
        const textEdit = item.textEdit ?? this.buildCompletionTextEdit(document, offset, label, insertText);
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

    protected buildCompletionTextEdit(document: TextDocument, offset: number, label: string, newText: string): TextEdit | undefined {
        const content = document.getText();
        const tokenStart = this.backtrackToTokenStart(content, offset);
        const identifier = content.substring(tokenStart, offset);
        if (this.charactersFuzzyMatch(identifier, label)) {
            const start = document.positionAt(tokenStart);
            const end = document.positionAt(offset);
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

    protected isWordCharacterAt(content: string, index: number): boolean {
        return this.grammarConfig.nameRegexp.test(content.charAt(index));
    }

    protected charactersFuzzyMatch(existingValue: string, completionValue: string): boolean {
        if (existingValue.length === 0) {
            return true;
        }

        completionValue = completionValue.toLowerCase();
        let matchedFirstCharacter = false;
        let previous: number | undefined;
        let character = 0;
        const len = completionValue.length;
        for (let i = 0; i < len; i++) {
            const strChar = completionValue.charCodeAt(i);
            const testChar = existingValue.charCodeAt(character);
            if (strChar === testChar || this.toUpperCharCode(strChar) === this.toUpperCharCode(testChar)) {
                matchedFirstCharacter ||=
                    previous === undefined || // Beginning of word
                    this.isWordTransition(previous, strChar);
                if (matchedFirstCharacter) {
                    character++;
                }
                if (character === existingValue.length) {
                    return true;
                }
            }
            previous = strChar;
        }
        return false;
    }

    protected isWordTransition(previous: number, current: number): boolean {
        return a <= previous && previous <= z && A <= current && current <= Z || // camelCase transition
            previous === _ && current !== _; // snake_case transition
    }

    protected toUpperCharCode(charCode: number) {
        if (a <= charCode && charCode <= z) {
            return charCode - 32;
        }
        return charCode;
    }
}

const a = 'a'.charCodeAt(0);
const z = 'z'.charCodeAt(0);
const A = 'A'.charCodeAt(0);
const Z = 'Z'.charCodeAt(0);
const _ = '_'.charCodeAt(0);
