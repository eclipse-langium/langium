/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CancellationToken, CompletionItem, CompletionItemKind, CompletionList, CompletionParams } from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import * as ast from '../../grammar/generated/ast';
import { getTypeNameAtElement } from '../../grammar/grammar-util';
import { isNamed } from '../../references/naming';
import { ScopeProvider } from '../../references/scope';
import { LangiumServices } from '../../services';
import { AstNode, AstNodeDescription, CstNode } from '../../syntax-tree';
import { getContainerOfType, isAstNode } from '../../utils/ast-util';
import { findLeafNodeAtOffset, findRelevantNode, flatten } from '../../utils/cst-util';
import { MaybePromise } from '../../utils/promise-util';
import { stream } from '../../utils/stream';
import { LangiumDocument } from '../../workspace/documents';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';
import { RuleInterpreter } from './rule-interpreter';

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
    getCompletion(document: LangiumDocument, params: CompletionParams, cancelToken?: CancellationToken): MaybePromise<CompletionList>
}

export class DefaultCompletionProvider implements CompletionProvider {

    protected readonly scopeProvider: ScopeProvider;
    protected readonly ruleInterpreter: RuleInterpreter;
    protected readonly grammar: ast.Grammar;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.ruleInterpreter = services.lsp.completion.RuleInterpreter;
        this.grammar = services.Grammar;
    }

    getCompletion(document: LangiumDocument, params: CompletionParams): MaybePromise<CompletionList> {
        const root = document.parseResult.value;
        const cst = root.$cstNode;
        const items: CompletionItem[] = [];
        const offset = document.textDocument.offsetAt(params.position);
        const acceptor = (value: string | AstNode | AstNodeDescription, item?: Partial<CompletionItem>) => {
            const completionItem = this.fillCompletionItem(document.textDocument, offset, value, item);
            if (completionItem) {
                items.push(completionItem);
            }
        };
        if (cst) {
            const node = findLeafNodeAtOffset(cst, offset);
            if (node) {
                const features = findNextFeatures(this.buildFeatureStack(node));
                const commonSuperRule = this.findCommonSuperRule(node);
                // In some cases, it is possible that we do not have a super rule
                if (commonSuperRule) {
                    const flattened = flatten(commonSuperRule.node).filter(e => e.offset < offset);
                    const possibleFeatures = this.ruleInterpreter.interpretRule(commonSuperRule.rule, [...flattened], offset);
                    // Remove features which we already identified during parsing
                    const partialMatches = possibleFeatures.filter(e => {
                        const match = this.ruleInterpreter.featureMatches(e, flattened[flattened.length - 1], offset);
                        return match === 'partial' || match === 'both';
                    });
                    const notMatchingFeatures = possibleFeatures.filter(e => !partialMatches.includes(e));
                    features.push(...partialMatches);
                    features.push(...notMatchingFeatures.flatMap(e => findNextFeatures([e])));
                }
                if (node.end > offset) {
                    features.push(node.feature);
                }
                stream(features).distinct(e => {
                    if (ast.isKeyword(e)) {
                        return e.value;
                    } else {
                        return e;
                    }
                }).forEach(e => this.completionFor(findRelevantNode(node), e, acceptor));
            } else {
                // The entry rule is the first parser rule
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const parserRule = this.grammar.rules.find(e => ast.isParserRule(e))!;
                this.completionForRule(undefined, parserRule, acceptor);
            }
        }
        return CompletionList.create(items, true);
    }

    protected buildFeatureStack(node: CstNode | undefined): ast.AbstractElement[] {
        const features: ast.AbstractElement[] = [];
        while (node) {
            if (node.feature) {
                features.push(node.feature);
            }
            node = node.parent;
        }
        return features;
    }

    protected completionForRule(astNode: AstNode | undefined, rule: ast.AbstractRule, acceptor: CompletionAcceptor): void {
        if (ast.isParserRule(rule)) {
            const features = findFirstFeatures(rule.alternatives);
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
            const scope = this.scopeProvider.getScope(context, `${getTypeNameAtElement(parserRule, assignment)}:${assignment.feature}`);
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

    protected findCommonSuperRule(node: CstNode): { rule: ast.ParserRule, node: CstNode } | undefined {
        while (typeof node.element.$type !== 'string') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            node = node.parent!;
        }
        let superNode = node.parent;
        while (superNode) {
            if (superNode.element !== node.element) {
                const topFeature = node.feature;
                if (ast.isRuleCall(topFeature) && topFeature.rule.ref) {
                    const rule = <ast.ParserRule>topFeature.rule.ref;
                    return { rule, node };
                }
                throw new Error();
            }
            node = superNode;
            superNode = node.parent;
        }
        return undefined;
    }

    protected fillCompletionItem(document: TextDocument, offset: number, value: string | AstNode | AstNodeDescription, info: Partial<CompletionItem> | undefined): CompletionItem | undefined {
        let label: string;
        if (typeof value === 'string') {
            label = value;
        } else if (isAstNode(value) && isNamed(value)) {
            label = value.name;
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
