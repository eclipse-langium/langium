import { CompletionItem, CompletionItemKind, CompletionList } from 'vscode-languageserver';
import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import * as ast from '../../grammar/generated/ast';
import { GrammarAccess } from '../../grammar/grammar-access';
import { findLeafNodeAtOffset } from '../../grammar/grammar-util';
import { isNamed } from '../../references/naming';
import { AstNodeDescription, ScopeProvider } from '../../references/scope';
import { LangiumServices } from '../../services';
import { AstNode, CstNode } from '../../syntax-tree';
import { getContainerOfType, isAstNode } from '../../utils/ast-util';
import { flatten } from '../../utils/cst-util';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';
import { RuleInterpreter } from './rule-interpreter';

export type CompletionAcceptor = (value: string | AstNode | AstNodeDescription, item?: Partial<CompletionItem>) => void

export interface CompletionProvider {
    getCompletion(root: AstNode, offset: number): CompletionList
}

export class DefaultCompletionProvider {

    protected readonly scopeProvider: ScopeProvider;
    protected readonly ruleInterpreter: RuleInterpreter;
    protected readonly grammarAccess: GrammarAccess;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.ruleInterpreter = services.completion.RuleInterpreter;
        this.grammarAccess = services.GrammarAccess;
    }

    getCompletion(root: AstNode, offset: number): CompletionList {
        const cst = root.$cstNode;
        const items: CompletionItem[] = [];
        const acceptor = (value: string | AstNode | AstNodeDescription, item?: Partial<CompletionItem>) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const completionItem = this.fillCompletionItem(root.$document!, offset, value, item);
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
                    const flattened = flatten(commonSuperRule.node);
                    const possibleFeatures = this.ruleInterpreter.interpretRule(commonSuperRule.rule, [...flattened]);
                    // Remove features which we already identified during parsing
                    const filteredFeatures = possibleFeatures.filter(e => e !== node.feature);
                    const partialMatches = filteredFeatures.filter(e => this.ruleInterpreter.featureMatches(e, flattened[flattened.length - 1]) === 'partial');
                    const notMatchingFeatures = filteredFeatures.filter(e => !partialMatches.includes(e));
                    features.push(...partialMatches);
                    features.push(...notMatchingFeatures.flatMap(e => findNextFeatures([e])));
                }
                features.forEach(e => this.buildContentAssistFor(node.element, e, acceptor));
            } else {
                // The entry rule is the first parser rule
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const parserRule = this.grammarAccess.grammar.rules.find(e => ast.isParserRule(e))!;
                this.buildContentAssistForRule(undefined, parserRule, acceptor);
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

    protected buildContentAssistForRule(astNode: AstNode | undefined, rule: ast.AbstractRule, acceptor: CompletionAcceptor): void {
        if (ast.isParserRule(rule)) {
            const features = findFirstFeatures(rule.alternatives);
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
            scope.getAllElements().forEach(e => {
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
        const item: CompletionItem = { label, textEdit };
        if (info) {
            Object.assign(item, info);
        }
        return item;
    }

    protected buildCompletionTextEdit(document: TextDocument, offset: number, completion: string): TextEdit {
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
            newText: completion,
            range: {
                start,
                end
            }
        };
    }
}