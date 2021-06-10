import * as ast from '../grammar/generated/ast';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { FollowElementComputation } from './follow-element-computation';

type MatchType = 'full' | 'partial' | 'none';

export class RuleInterpreter {

    protected readonly followElementComputation: FollowElementComputation;

    constructor(services: LangiumServices) {
        this.followElementComputation = services.completion.FollowElementComputation;
    }

    interpretRule(rule: ast.ParserRule, nodes: CstNode[]): ast.AbstractElement[] {
        let features: ast.AbstractElement[] = [];
        let nextFeatures = this.followElementComputation.findFirstFeatures(rule.alternatives);
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
            nextFeatures = features.flatMap(e => this.followElementComputation.findNextFeatures([e]));
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
            const ruleFeatures = this.followElementComputation.findFirstFeatures(rule.alternatives);
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