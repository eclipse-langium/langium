import * as ast from '../../gen/ast';
import { AstNode, CstNode } from '../../generator/ast-node';
import { findLeafNodeAtOffset } from '../../grammar/grammar-utils';
import { buildContentAssistFor, buildContentAssistForRule, findFirstFeatures, findNextFeatures } from './content-assist-builder';

export function contentAssist(grammar: ast.Grammar, root: AstNode, offset: number): string[] {
    const cst = root.$cstNode;
    if (cst) {
        const node = findLeafNodeAtOffset(cst, offset);
        if (node) {
            const features = findNextFeatures(buildFeatureStack(node));
            const commonSuperRule = findCommonSuperRule(node);
            // In some cases, it is possible that we do not have a super rule
            if (commonSuperRule) {
                const flattened = CstNode.flatten(commonSuperRule.node);
                const possibleFeatures = interpretRule(commonSuperRule.rule, [...flattened]);
                // Remove features which we already identified during parsing
                const filteredFeatures = possibleFeatures.filter(e => e !== node.feature);
                const partialMatches = filteredFeatures.filter(e => featureMatches(e, flattened[flattened.length - 1]) === 'partial');
                const notMatchingFeatures = filteredFeatures.filter(e => !partialMatches.includes(e));
                features.push(...partialMatches);
                features.push(...notMatchingFeatures.flatMap(e => findNextFeatures([e])));
            }
            return features.flatMap(e => buildContentAssistFor(e));
        } else {
            // The entry rule is the first parser rule
            const parserRule = <ast.ParserRule>grammar.rules.find(e => ast.isParserRule(e));
            return buildContentAssistForRule(parserRule);
        }
    } else {
        return [];
    }
}

function buildFeatureStack(node: CstNode | undefined): ast.AbstractElement[] {
    const features: ast.AbstractElement[] = [];
    while (node) {
        if (node.feature) {
            features.push(node.feature);
        }
        node = node.parent;
    }
    return features;
}

function findCommonSuperRule(node: CstNode): { rule: ast.ParserRule, node: CstNode } | undefined {
    let superNode = node.parent;
    while (superNode) {
        if (superNode.element !== node.element) {
            const topFeature = node.feature;
            if (ast.isRuleCall(topFeature) && topFeature.rule.value) {
                const rule = <ast.ParserRule>topFeature.rule.value;
                return { rule, node };
            }
            throw new Error();
        }
        node = superNode;
        superNode = node.parent;
    }
    return undefined;
}

function interpretRule(rule: ast.ParserRule, nodes: CstNode[]): ast.AbstractElement[] {
    let features: ast.AbstractElement[] = [];
    let nextFeatures = findFirstFeatures(rule.alternatives);
    let node = nodes.shift();
    while (node && nextFeatures.length > 0) {
        const n = node;
        features = nextFeatures.filter(e => {
            const match = featureMatches(e, n);
            if (nodes.length === 0 && match === 'partial') {
                return true;
            }
            return match === 'full';
        });
        nextFeatures = features.flatMap(e => findNextFeatures([e]));
        node = nodes.shift();
    }
    return features;
}

function featureMatches(feature: ast.AbstractElement, node: CstNode): MatchType {
    if (ast.isKeyword(feature)) {
        const content = feature.value.substring(1, feature.value.length - 1);
        if (content === node.text) {
            return 'full';
        } else if (content.startsWith(node.text)) {
            return 'partial';
        } else {
            return 'none';
        }
    } else if (ast.isRuleCall(feature)) {
        return ruleMatches(feature.rule.value, node);
    } else if (ast.isCrossReference(feature)) {
        return featureMatches(feature.terminal, node);
    }
    return 'none';
}

function ruleMatches(rule: ast.AbstractRule | undefined, node: CstNode): MatchType {
    if (ast.isParserRule(rule)) {
        const ruleFeatures = findFirstFeatures(rule.alternatives);
        return ruleFeatures.some(e => featureMatches(e, node)) ? 'full' : 'none';
    } else if (ast.isTerminalRule(rule)) {
        // We have to take keywords into account
        // e.g. most keywords are valid IDs as well
        // Only return 'full' if this terminal does not match a keyword. TODO
        const regex = rule.regex.substring(1, rule.regex.length - 1);
        return node.text.match(new RegExp(regex)) !== null ? 'full' : 'none';
    } else {
        return 'none';
    }
}

type MatchType = 'full' | 'partial' | 'none';
