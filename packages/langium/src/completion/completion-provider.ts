import { Command, CompletionItemKind, CompletionItemTag, InsertReplaceEdit, InsertTextMode, MarkupContent, TextEdit } from 'vscode-languageserver';
import * as ast from '../grammar/generated/ast';
import { findLeafNodeAtOffset } from '../grammar/grammar-util';
import { AstNodeDescription, ScopeProvider } from '../references/scope';
import { LangiumServices } from '../services';
import { AstNode, CstNode } from '../syntax-tree';
import { getContainerOfType } from '../utils/ast-util';
import { flatten } from '../utils/cst-util';
import { FollowElementComputation } from './follow-element-computation';
import { RuleInterpreter } from './rule-interpreter';

export type CompletionInfo = {
    /**
     * The label of this completion item. By default
     * also the text that is inserted when selecting
     * this completion.
     */
    label: string;
    /**
     * The kind of this completion item. Based of the kind
     * an icon is chosen by the editor.
     */
    kind?: CompletionItemKind;
    /**
     * Tags for this completion item.
     *
     * @since 3.15.0
     */
    tags?: CompletionItemTag[];
    /**
     * A human-readable string with additional information
     * about this item, like type or symbol information.
     */
    detail?: string;
    /**
     * A human-readable string that represents a doc-comment.
     */
    documentation?: string | MarkupContent;
    /**
     * Indicates if this item is deprecated.
     * @deprecated Use `tags` instead.
     */
    deprecated?: boolean;
    /**
     * Select this item when showing.
     *
     * *Note* that only one completion item can be selected and that the
     * tool / client decides which item that is. The rule is that the *first*
     * item of those that match best is selected.
     */
    preselect?: boolean;
    /**
     * A string that should be used when comparing this item
     * with other items. When `falsy` the [label](#CompletionItem.label)
     * is used.
     */
    sortText?: string;
    /**
     * A string that should be used when filtering a set of
     * completion items. When `falsy` the [label](#CompletionItem.label)
     * is used.
     */
    filterText?: string;
    /**
     * How whitespace and indentation is handled during completion
     * item insertion. If ignored the clients default value depends on
     * the `textDocument.completion.insertTextMode` client capability.
     *
     * @since 3.16.0
     */
    insertTextMode?: InsertTextMode;
    /**
     * An [edit](#TextEdit) which is applied to a document when selecting
     * this completion. When an edit is provided the value of
     * [insertText](#CompletionItem.insertText) is ignored.
     *
     * Most editors support two different operation when accepting a completion item. One is to insert a
     * completion text and the other is to replace an existing text with a completion text. Since this can
     * usually not predetermined by a server it can report both ranges. Clients need to signal support for
     * `InsertReplaceEdits` via the `textDocument.completion.insertReplaceSupport` client capability
     * property.
     *
     * *Note 1:* The text edit's range as well as both ranges from a insert replace edit must be a
     * [single line] and they must contain the position at which completion has been requested.
     * *Note 2:* If an `InsertReplaceEdit` is returned the edit's insert range must be a prefix of
     * the edit's replace range, that means it must be contained and starting at the same position.
     *
     * @since 3.16.0 additional type `InsertReplaceEdit`
     */
    textEdit?: TextEdit | InsertReplaceEdit;
    /**
     * An optional array of additional [text edits](#TextEdit) that are applied when
     * selecting this completion. Edits must not overlap (including the same insert position)
     * with the main [edit](#CompletionItem.textEdit) nor with themselves.
     *
     * Additional text edits should be used to change text unrelated to the current cursor position
     * (for example adding an import statement at the top of the file if the completion item will
     * insert an unqualified type).
     */
    additionalTextEdits?: TextEdit[];
    /**
     * An optional set of characters that when pressed while this completion is active will accept it first and
     * then type that character. *Note* that all commit characters should have `length=1` and that superfluous
     * characters will be ignored.
     */
    commitCharacters?: string[];
    /**
     * An optional [command](#Command) that is executed *after* inserting this completion. *Note* that
     * additional modifications to the current document should be described with the
     * [additionalTextEdits](#CompletionItem.additionalTextEdits)-property.
     */
    command?: Command;
    /**
     * A data entry field that is preserved on a completion item between
     * a [CompletionRequest](#CompletionRequest) and a [CompletionResolveRequest]
     * (#CompletionResolveRequest)
     */
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

    contentAssist(grammar: ast.Grammar, root: AstNode, offset: number): string[] {
        const cst = root.$cstNode;
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
                return features.flatMap(e => this.buildContentAssistFor(node.element, e));
            } else {
                // The entry rule is the first parser rule
                const parserRule = <ast.ParserRule>grammar.rules.find(e => ast.isParserRule(e));
                return this.buildContentAssistForRule(undefined, parserRule);
            }
        } else {
            return [];
        }
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

    protected buildContentAssistForRule(astNode: AstNode | undefined, rule: ast.AbstractRule): string[] {
        if (ast.isTerminalRule(rule)) {
            return [rule.name];
        } else if (ast.isParserRule(rule)) {
            const features = this.followElementComputation.findFirstFeatures(rule.alternatives);
            return features.flatMap(e => this.buildContentAssistFor(astNode, e));
        } else {
            return [];
        }
    }

    protected buildContentAssistFor(astNode: AstNode | undefined, feature: ast.AbstractElement): string[] {
        if (ast.isKeyword(feature)) {
            return [feature.value.substring(1, feature.value.length - 1)];
        } else if (ast.isRuleCall(feature) && feature.rule.ref) {
            return this.buildContentAssistForRule(astNode, feature.rule.ref);
        } else if (ast.isCrossReference(feature) && astNode) {
            const assignment = getContainerOfType(feature, ast.isAssignment);
            const parserRule = getContainerOfType(feature, ast.isParserRule);
            if (assignment && parserRule) {
                const scope = this.scopeProvider.getScope(astNode, `${parserRule.name}:${assignment.feature}`);
                return scope.getAllDescriptions().map(e => e.name);
            }
        }
        return [];
    }

    protected forCrossReference(crossRef: ast.CrossReference, context: AstNode | undefined, acceptor: CompletionAcceptor): void {
        if (context) {
            const assignment = getContainerOfType(crossRef, ast.isAssignment);
            const parserRule = getContainerOfType(crossRef, ast.isParserRule);
            if (assignment && parserRule) {
                const scope = this.scopeProvider.getScope(context, `${parserRule.name}:${assignment.feature}`);
                scope.getAllDescriptions().map(e => e.name).forEach(e => {
                    acceptor(e);
                });
            }
        }
    }

    protected forKeyword(keyword: ast.Keyword, context: AstNode | undefined, acceptor: CompletionAcceptor): void {
        acceptor(keyword.value.substring(1, keyword.value.length - 1));
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
}