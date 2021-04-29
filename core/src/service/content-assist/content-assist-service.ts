import { AbstractElement, AbstractRule, CrossReference, Grammar, Keyword, ParserRule, RuleCall, TerminalRule } from '../../gen/ast';
import { AstNode, CstNode } from '../../generator/ast-node';
import { findLeafNodeAtOffset } from '../../grammar/grammar-utils';
import { buildContentAssistFor, buildContentAssistForRule, findFirstFeatures, findNextFeatures } from './content-assist-builder';

export function contentAssist(grammar: Grammar, root: AstNode, offset: number): string[] {
    const cst = root[AstNode.cstNode];
    if (cst) {
        const node = findLeafNodeAtOffset(cst, offset);
        if (node) {
            const commonSuperRule = findCommonSuperRule(node);
            const flattened = CstNode.flatten(commonSuperRule.node).sort((a, b) => b.offset - a.offset);
            const possibleFeatures = interpretRule(commonSuperRule.rule, flattened);
            // Remove features which we already identified during parsing
            const filteredFeatures = possibleFeatures.filter(e => e !== node.feature);
            const features = findNextFeatures(buildFeatureStack(node));
            features.push(...filteredFeatures.flatMap(e => findNextFeatures([e])));
            return features.flatMap(e => buildContentAssistFor(e));
        } else {
            return buildContentAssistForRule(grammar.rules[0]);
        }
    } else {
        return [];
    }
}

function buildFeatureStack(node: CstNode | undefined): AbstractElement[] {
    const features: AbstractElement[] = [];
    while (node) {
        if (node.feature) {
            features.push(node.feature);
        }
        node = node.parent;
    }
    return features;
}

function findCommonSuperRule(node: CstNode): { rule: ParserRule, node: CstNode } {
    let superNode = node.parent;
    while (superNode) {
        if (superNode.element !== node.element) {
            const topFeature = node.feature;
            if (RuleCall.is(topFeature) && topFeature.rule.value) {
                const rule = <ParserRule>topFeature.rule.value;
                return { rule, node };
            }
            throw new Error();
        }
        node = superNode;
        superNode = node.parent;
    }
    throw new Error();
}

function interpretRule(rule: ParserRule, nodes: CstNode[]): AbstractElement[] {
    let features: AbstractElement[] = [];
    let nextFeatures = findFirstFeatures(rule.alternatives);
    let node = nodes.pop();
    while (node && nextFeatures.length > 0) {
        const n = node;
        features = nextFeatures.filter(e => featureMatches(e, n));
        nextFeatures = features.flatMap(e => findNextFeatures([e]));
        node = nodes.pop();
    }
    return features;
}

function featureMatches(feature: AbstractElement, node: CstNode): boolean {
    if (Keyword.is(feature)) {
        const content = feature.value.substring(1, feature.value.length - 1);
        return content === node.text;
    } else if (RuleCall.is(feature)) {
        return ruleMatches(feature.rule.value, node);
    } else if (CrossReference.is(feature)) {
        return featureMatches(feature.terminal, node);
    }
    return false;
}

function ruleMatches(rule: AbstractRule | undefined, node: CstNode): boolean {
    if (ParserRule.is(rule)) {
        const ruleFeatures = findFirstFeatures(rule.alternatives);
        return ruleFeatures.some(e => featureMatches(e, node));
    } else if (TerminalRule.is(rule)) {
        const regex = rule.regex.substring(1, rule.regex.length - 1);
        return node.text.match(new RegExp(regex)) !== null;
    } else {
        return false;
    }
}