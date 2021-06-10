import { Command, CompletionItem, CompletionItemKind, CompletionItemTag, CompletionList, InsertReplaceEdit, InsertTextMode, MarkupContent, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as ast from '../grammar/generated/ast';
import { findLeafNodeAtOffset } from '../grammar/grammar-util';
import { isNamed } from '../references/naming';
import { AstNodeDescription, ScopeProvider } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode, CstNode } from '../syntax-tree';
import { getContainerOfType, isAstNode } from '../utils/ast-util';
import { flatten } from '../utils/cst-util';
import { FollowElementComputation } from './follow-element-computation';
import { RuleInterpreter } from './rule-interpreter';

// TODO: Decice which of these properties we actually need
export type CompletionInfo = {
    label?: string;
    kind?: CompletionItemKind;
    tags?: CompletionItemTag[];
    detail?: string;
    documentation?: string | MarkupContent;
    deprecated?: boolean;
    preselect?: boolean;
    sortText?: string;
    filterText?: string;
    insertTextMode?: InsertTextMode;
    textEdit?: TextEdit | InsertReplaceEdit;
    additionalTextEdits?: TextEdit[];
    commitCharacters?: string[];
    command?: Command;
    data?: unknown;
}

export type CompletionAcceptor = (value: string | AstNode | AstNodeDescription, info?: CompletionInfo) => void

export class CompletionProvider {

    protected readonly scopeProvider: ScopeProvider;
    protected readonly followElementComputation: FollowElementComputation;
    protected readonly ruleInterpreter: RuleInterpreter;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.followElementComputation = services.completion.FollowElementComputation;
        this.ruleInterpreter = services.completion.RuleInterpreter;
    }

    contentAssist(grammar: ast.Grammar, root: AstNode, offset: number): CompletionList {
        const cst = root.$cstNode;
        const items: CompletionItem[] = [];
        const acceptor = (value: string | AstNode | AstNodeDescription, info?: CompletionInfo) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const item = this.toCompletionItem(root.$document!, offset, value, info);
            if (item) {
                items.push(item);
            }
        };
        if (cst) {
            const node = findLeafNodeAtOffset(cst, offset);
            if (node) {
                const features = this.followElementComputation.findNextFeatures(this.buildFeatureStack(node));
                const commonSuperRule = this.findCommonSuperRule(node);
                // In some cases, it is possible that we do not have a super rule
                if (commonSuperRule) {
                    const flattened = flatten(commonSuperRule.node);
                    const possibleFeatures = this.ruleInterpreter.interpretRule(commonSuperRule.rule, [...flattened]);
                    // Remove features which we already identified during parsing
                    const filteredFeatures = possibleFeatures.filter(e => e !== node.feature);
                    const partialMatches = filteredFeatures.filter(e => this.ruleInterpreter.featureMatches(e, flattened[flattened.length - 1]) === 'partial');
                    const notMatchingFeatures = filteredFeatures.filter(e => !partialMatches.includes(e));
                    features.push(...partialMatches);
                    features.push(...notMatchingFeatures.flatMap(e => this.followElementComputation.findNextFeatures([e])));
                }
                features.flatMap(e => this.buildContentAssistFor(node.element, e, acceptor));
            } else {
                // The entry rule is the first parser rule
                const parserRule = <ast.ParserRule>grammar.rules.find(e => ast.isParserRule(e));
                this.buildContentAssistForRule(undefined, parserRule, acceptor);
            }
        }
        return CompletionList.create(items, true);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected toCompletionItem(document: TextDocument, offset: number, value: string | AstNode | AstNodeDescription, info: CompletionInfo | undefined): CompletionItem | undefined {
        let text: string;
        if (typeof value === 'string') {
            text = value;
        } else if (isAstNode(value) && isNamed(value)) {
            text = value.name;
        } else if (!isAstNode(value)) {
            text = value.name;
        } else {
            return undefined;
        }
        const item = this.buildCompletionItem(document, offset, text);
        if (info) {
            Object.assign(item, info);
        }
        return item;
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

    protected buildContentAssistForRule(astNode: AstNode | undefined, rule: ast.AbstractRule, acceptor: CompletionAcceptor): void {
        if (ast.isParserRule(rule)) {
            const features = this.followElementComputation.findFirstFeatures(rule.alternatives);
            features.flatMap(e => this.buildContentAssistFor(astNode, e, acceptor));
        }
    }

    protected buildContentAssistFor(astNode: AstNode | undefined, feature: ast.AbstractElement, acceptor: CompletionAcceptor): void {
        if (ast.isKeyword(feature)) {
            this.forKeyword(feature, astNode, acceptor);
        } else if (ast.isRuleCall(feature) && feature.rule.ref) {
            return this.buildContentAssistForRule(astNode, feature.rule.ref, acceptor);
        } else if (ast.isCrossReference(feature) && astNode) {
            this.forCrossReference(feature, astNode, acceptor);
        }
    }

    protected forCrossReference(crossRef: ast.CrossReference, context: AstNode, acceptor: CompletionAcceptor): void {
        const assignment = getContainerOfType(crossRef, ast.isAssignment);
        const parserRule = getContainerOfType(crossRef, ast.isParserRule);
        if (assignment && parserRule) {
            const scope = this.scopeProvider.getScope(context, `${parserRule.name}:${assignment.feature}`);
            scope.getAllDescriptions().forEach(e => {
                acceptor(e, { kind: CompletionItemKind.Reference, detail: e.type });
            });
        }
    }

    protected forKeyword(keyword: ast.Keyword, context: AstNode | undefined, acceptor: CompletionAcceptor): void {
        acceptor(keyword.value.substring(1, keyword.value.length - 1), { kind: CompletionItemKind.Keyword, detail: 'Keyword' });
    }

    protected findCommonSuperRule(node: CstNode): { rule: ast.ParserRule, node: CstNode } | undefined {
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

    protected buildCompletionItem(document: TextDocument, offset: number, completion: string): CompletionItem {
        let negativeOffset = 0;
        const content = document.getText();
        for (let i = completion.length; i > 0; i--) {
            const contentSub = content.substring(content.length - i);
            if (completion.startsWith(contentSub)) {
                negativeOffset = i;
                break;
            }
        }
        const start = document.positionAt(offset - negativeOffset);
        const end = document.positionAt(offset);
        return {
            label: completion,
            textEdit: {
                newText: completion,
                range: {
                    start,
                    end
                }
            }
        };
    }
}