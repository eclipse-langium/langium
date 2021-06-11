import * as ast from '../../grammar/generated/ast';
import { CstNode } from '../../syntax-tree';
import { findFirstFeatures, findNextFeatures } from './follow-element-computation';

type MatchType = 'full' | 'partial' | 'none';

/**
 * The `RuleInterpreter` is used by the `CompletionProvider` to identify any `AbstractElement` that could apply at a given cursor position.
 *
 * This is necessary as the parser uses the best fitting grammar rule for any given text input.
 * Assuming we could have multiple different applying rules at a certain point in the text input, only one of those will be successfully parsed.
 * However, this `RuleInterpreter` will return **all** possible features that are applicable.
 */
export class RuleInterpreter {

    interpretRule(rule: ast.ParserRule, nodes: CstNode[]): ast.AbstractElement[] {
        let features: ast.AbstractElement[] = [];
        let nextFeatures = findFirstFeatures(rule.alternatives);
        let node = nodes.shift();
        while (node && nextFeatures.length > 0) {
            const n = node;
            features = nextFeatures.filter(e => {
                const match = this.featureMatches(e, n);
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

    featureMatches(feature: ast.AbstractElement, node: CstNode): MatchType {
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
            return this.ruleMatches(feature.rule.ref, node);
        } else if (ast.isCrossReference(feature)) {
            return this.featureMatches(feature.terminal, node);
        }
        return 'none';
    }

    ruleMatches(rule: ast.AbstractRule | undefined, node: CstNode): MatchType {
        if (ast.isParserRule(rule)) {
            const ruleFeatures = findFirstFeatures(rule.alternatives);
            return ruleFeatures.some(e => this.featureMatches(e, node)) ? 'full' : 'none';
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

}