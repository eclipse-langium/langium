/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as ast from '../../grammar/generated/ast';
import { isDataTypeRule } from '../../grammar/grammar-util';
import { CstNode } from '../../syntax-tree';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';

type MatchType = 'full' | 'both' | 'partial' | 'none';

/**
 * The `RuleInterpreter` is used by the `CompletionProvider` to identify any `AbstractElement` that could apply at a given cursor position.
 *
 * This is necessary as the parser uses the best fitting grammar rule for any given text input.
 * Assuming we could have multiple different applying rules at a certain point in the text input, only one of those will be successfully parsed.
 * However, this `RuleInterpreter` will return **all** possible features that are applicable.
 */
export class RuleInterpreter {

    interpretRule(rule: ast.ParserRule, nodes: CstNode[], offset: number): ast.AbstractElement[] {
        let features: ast.AbstractElement[] = [];
        let nextFeatures = findFirstFeatures(rule.alternatives);
        let node = nodes.shift();
        while (node && nextFeatures.length > 0) {
            const n = node;
            const feats: ast.AbstractElement[] = [];
            features = [];
            nextFeatures.forEach(e => {
                const match = this.featureMatches(e, n, offset);
                if (nodes.length === 0 && match !== 'none') {
                    feats.push(e);
                }
                if (match === 'full' || match === 'both') {
                    features.push(e);
                }
            });
            nextFeatures = features.flatMap(e => findNextFeatures([e]));
            features.push(...feats);
            node = nodes.shift();
        }
        return features;
    }

    featureMatches(feature: ast.AbstractElement, node: CstNode, offset: number): MatchType {
        if (ast.isKeyword(feature)) {
            const content = feature.value;
            const nodeEnd = node.range.end;
            const text = nodeEnd > offset ? node.text.substring(0, nodeEnd - offset) : node.text;
            if (content === text) {
                return 'full';
            } else if (content.startsWith(text)) {
                return 'partial';
            } else {
                return 'none';
            }
        } else if (ast.isRuleCall(feature)) {
            return this.ruleMatches(feature.rule.ref, node, offset);
        } else if (ast.isCrossReference(feature)) {
            return this.featureMatches(feature.terminal, node, offset);
        }
        return 'none';
    }

    ruleMatches(rule: ast.AbstractRule | undefined, node: CstNode, offset: number): MatchType {
        if (ast.isParserRule(rule)) {
            const ruleFeatures = findFirstFeatures(rule.alternatives);
            const matchType = isDataTypeRule(rule) ? 'both' : 'full';
            return ruleFeatures.some(e => this.featureMatches(e, node, offset)) ? matchType : 'none';
        } else if (ast.isTerminalRule(rule)) {
            // We have to take keywords into account
            // e.g. most keywords are valid IDs as well
            // Only return 'full' if this terminal does not match a keyword. TODO
            return node.text.match(new RegExp(rule.regex)) !== null ? 'both' : 'none';
        } else {
            return 'none';
        }
    }

}
